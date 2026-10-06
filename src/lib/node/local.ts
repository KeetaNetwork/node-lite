import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';
import type { BootstrapConfig } from '../bootstrap';
import { BootstrapClient } from '../bootstrap';
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Node } from './index';
import type { NodeConfig } from './index';
import { checkableGenerator } from '../utils/helper';
import { P2PWebSocket, P2P_WEBSOCKET_MAX_PAYLOAD_BYTES } from '../p2p';
import apiHandlers, { type APIRequest } from '../../api';
import { toJSONSerializable } from '../utils/conversion';
import { KeetaNetErrorBase } from '../error/base';

export type LocalNodeConfig = Omit<NodeConfig, 'nodeOptions'> & {
	bootstrap?: BootstrapConfig;
	invokeSecret?: string;
	nodeOptions?: {
		listenIP?: string;
		listenPort?: number;
		timingSampleRate?: number;
		noSyncAfterEachRoute?: boolean;
	};
};

type LocalNodeRunOptions = {
	startWebSocketServer?: boolean;
};

type ErrorJSON = {
	type?: string;
	code?: string;
	message?: string;
};

export type ApiErrorResponse = {
	error: boolean;
	message: string;
	type?: string | null;
	code?: string | null;
};

function listenTarget(urlString: string): { host: string; port: number } {
	const url = new URL(urlString);
	const port = Number(url.port);
	if (!Number.isFinite(port) || port <= 0) {
		throw(new Error(`invalid endpoint port: ${urlString}`));
	}
	return({ host: url.hostname, port });
}

function queryStrings(query: ExpressRequest['query']): { [name: string]: string } {
	const result: { [name: string]: string } = {};
	for (const [key, value] of Object.entries(query)) {
		if (typeof value === 'string') {
			result[key] = value;
		} else if (Array.isArray(value) && typeof value[0] === 'string') {
			result[key] = value[0];
		}
	}
	return(result);
}

function paramStrings(params: ExpressRequest['params']): { [name: string]: string } {
	const result: { [name: string]: string } = {};
	if (params === undefined || typeof params !== 'object') {
		return(result);
	}
	for (const [key, value] of Object.entries(params)) {
		if (typeof value === 'string') {
			result[key] = value;
		}
	}
	return(result);
}

function sendJSON(response: ExpressResponse, status: number, payload: unknown): void {
	response.status(status).type('application/json').send(JSON.stringify(toJSONSerializable(payload, { addBinary: true })));
}

function errorBody(error: unknown): { status: number; body: ApiErrorResponse } {
	if (KeetaNetErrorBase.isInstance(error) || (
		typeof error === 'object' &&
		error !== null &&
		'toJSON' in error &&
		typeof (error as { toJSON: unknown }).toJSON === 'function'
	)) {
		const json = (error as { toJSON: () => ErrorJSON }).toJSON();
		if (json !== null && typeof json === 'object' && typeof json.message === 'string') {
			return({
				status: 400,
				body: {
					error: true,
					message: json.message,
					type: json.type ?? null,
					code: json.code ?? null,
					...json
				}
			});
		}
	}
	return({
		status: 500,
		body: {
			error: true,
			message: error instanceof Error ? error.message : String(error)
		}
	});
}

type ClientLocal = typeof import('@keetanetwork/keetanet-client/lib/node/local');
type ClientLocalNode = ClientLocal['LocalNode'];

class LocalNodeImpl extends Node {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is LocalNodeImpl =
		checkableGenerator(LocalNodeImpl);

	override config: LocalNodeConfig;
	#app = express();
	#bootstrap: InstanceType<typeof BootstrapClient> | undefined;
	#httpServer: http.Server | undefined;
	#p2pServer: http.Server | undefined;
	#wss: WebSocketServer | undefined;
	#routesAdded = false;

	constructor(config: LocalNodeConfig) {
		super(config);
		this.config = config;
		this.#app.use(express.json({ limit: '32mb' }));
		if (config.bootstrap !== undefined) {
			this.#bootstrap = new BootstrapClient(this, config.bootstrap);
		}
	}

	setCorsHeaders(_ignored_response: ExpressResponse): void {
		/* no-op for lite */
	}

	addRoutes(prefix = '/api'): void {
		if (this.#routesAdded) {
			return;
		}
		this.#routesAdded = true;

		const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
		for (const mapping of apiHandlers) {
			const method = mapping.method.toLowerCase() as 'get' | 'put' | 'post' | 'delete';
			const path = `${normalizedPrefix}${mapping.path}`;
			this.#app[method](path, (request: ExpressRequest, response: ExpressResponse, next: NextFunction) => {
				void (async () => {
					const apiRequest: APIRequest = {
						node: this,
						params: paramStrings(request.params),
						query: queryStrings(request.query),
						payload: request.body,
						header: {
							get: (name: string) => request.get(name)
						}
					};
					const paramNames = [...mapping.path.matchAll(/:([^/]+)/g)].map((match) => match[1]);
					const pathArgs = paramNames.map((name) => apiRequest.params[name]);
					const args = mapping.method === 'GET' || mapping.method === 'DELETE'
						? pathArgs
						: [apiRequest.payload, ...pathArgs];
					const result = await mapping.handler(apiRequest, ...args);
					sendJSON(response, 200, result);
				})().catch((error: unknown) => {
					next(error);
				});
			});
		}

		this.#app.use((error: unknown, _ignored_request: ExpressRequest, response: ExpressResponse, _ignored_next: NextFunction) => {
			const { status, body } = errorBody(error);
			sendJSON(response, status, body);
		});
	}

	get _app(): express.Express {
		return(this.#app);
	}

	async #listen(server: http.Server, host: string, port: number): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(port, host, () => resolve());
		});
	}

	override async run(options?: LocalNodeRunOptions): Promise<void> {
		await super.run();

		const startWs = options?.startWebSocketServer !== false;
		const apiEndpoint = this.config.endpoints?.api;
		const p2pEndpoint = this.config.endpoints?.p2p;
		const listenIP = this.config.nodeOptions?.listenIP;
		const listenPort = this.config.nodeOptions?.listenPort;

		let prefix = '/api';
		let httpListen: { host: string; port: number } | undefined;
		if (apiEndpoint !== undefined) {
			const pathname = new URL(apiEndpoint).pathname.replace(/\/$/, '');
			if (pathname !== '' && pathname !== '/') {
				prefix = pathname;
			}
		}
		if (listenIP !== undefined && listenPort !== undefined) {
			httpListen = { host: listenIP, port: listenPort };
		} else if (apiEndpoint !== undefined) {
			httpListen = listenTarget(apiEndpoint);
		}

		this.addRoutes(prefix);

		if (httpListen !== undefined) {
			this.#httpServer = http.createServer(this.#app);
			await this.#listen(this.#httpServer, httpListen.host, httpListen.port);
		}

		if (!startWs || p2pEndpoint === undefined) {
			return;
		}

		const p2p = listenTarget(p2pEndpoint);
		const apiBound = this.#httpServer?.address();
		const sameServer = apiBound !== undefined && apiBound !== null && typeof apiBound !== 'string'
			&& apiBound.port === p2p.port;
		const wsHttp = sameServer && this.#httpServer !== undefined
			? this.#httpServer
			: http.createServer();
		if (!sameServer) {
			this.#p2pServer = wsHttp;
			await this.#listen(wsHttp, p2p.host, p2p.port);
		}

		this.#wss = new WebSocketServer({
			server: wsHttp,
			path: '/p2p',
			maxPayload: P2P_WEBSOCKET_MAX_PAYLOAD_BYTES
		});
		this.#wss.on('connection', (socket, request) => {
			void P2PWebSocket.connectToSwitch(socket, this.switch, request.socket);
		});
	}

	static override main(config: LocalNodeConfig): void {
		const node = new LocalNodeImpl(config);
		void node.run();
	}

	override async stop(): Promise<void> {
		await this.#bootstrap?.stop();
		await new Promise<void>((resolve) => {
			if (this.#wss === undefined) {
				resolve();
				return;
			}
			this.#wss.close(() => resolve());
		});
		await new Promise<void>((resolve) => {
			if (this.#p2pServer === undefined) {
				resolve();
				return;
			}
			this.#p2pServer.close(() => resolve());
		});
		await new Promise<void>((resolve) => {
			if (this.#httpServer === undefined) {
				resolve();
				return;
			}
			this.#httpServer.close(() => resolve());
		});
		this.#wss = undefined;
		this.#p2pServer = undefined;
		this.#httpServer = undefined;
		await super.stop();
	}

	get bootstrap(): InstanceType<typeof BootstrapClient> | undefined {
		return(this.#bootstrap);
	}
}

const LocalNode = LocalNodeImpl;
type LocalNode = InstanceType<typeof LocalNode>;
export { LocalNode };
export default LocalNode;

type _AssertMatchesClient = AssertNever<
	| (PublicConstructable<typeof LocalNodeImpl> extends PublicConstructable<ClientLocalNode> ? never : PublicConstructable<typeof LocalNodeImpl>)
	| (PublicConstructable<ClientLocalNode> extends PublicConstructable<typeof LocalNodeImpl> ? never : PublicConstructable<ClientLocalNode>)
	| (Omit<typeof import('./local'), 'LocalNode' | 'default'> extends Omit<ClientLocal, 'LocalNode' | 'default'> ? never : Omit<typeof import('./local'), 'LocalNode' | 'default'>)
	| (Omit<ClientLocal, 'LocalNode' | 'default'> extends Omit<typeof import('./local'), 'LocalNode' | 'default'> ? never : Omit<ClientLocal, 'LocalNode' | 'default'>)
>;
