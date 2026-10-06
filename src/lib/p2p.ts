import { types as utilTypes } from 'util';
import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './utils/never';
import type { PublicConstructable } from './utils/static-types';
import type net from 'net';
import { WebSocket } from 'ws';
import * as uuid from 'uuid';
import Account from './account';
import { NodeKind } from './node';
import { ASN1toJS, JStoASN1 } from './utils/asn1';
import { checkableGenerator, bufferToArrayBuffer } from './utils/helper';
import { Hash } from './utils/hash';
import { version } from '../version';
import type { P2PPeer, P2PConnection } from '@keetanetwork/keetanet-client/lib/p2p';
import type { JSONSerializableObject } from '@keetanetwork/keetanet-client/lib/utils/conversion';

type ClientP2P = typeof import('@keetanetwork/keetanet-client/lib/p2p');

const P2PSwitch = lib.P2P as ClientP2P['P2PSwitch'];
type P2PSwitch = InstanceType<typeof P2PSwitch>;

export default P2PSwitch;
export { P2PSwitch };

export const P2P_WEBSOCKET_MAX_PAYLOAD_BYTES: ClientP2P['P2P_WEBSOCKET_MAX_PAYLOAD_BYTES'] = 16 * 1024 * 1024;

type P2PSwitchLog = {
	debug: (...message: unknown[]) => void;
	error: (...message: unknown[]) => void;
};

function p2pSwitchLog(p2pSwitch: P2PSwitch): P2PSwitchLog {
	const withLog = p2pSwitch as P2PSwitch & { _log?: P2PSwitchLog };
	return(withLog._log ?? {
		debug: (..._ignored_message: unknown[]) => undefined,
		error: (..._ignored_message: unknown[]) => undefined
	});
}

/* COPIED FROM CLIENT BUNDLE (MANUAL SYNC) */
function printablePeer(peer: any, endpoint?: any) {
    if (peer === null) {
        return ('null (not yet greeted)');
    }
    switch (peer.kind) {
        case NodeKind.PARTICIPANT:
            return `listener_${peer.id}`;
        case NodeKind.REPRESENTATIVE:
            return (`rep_${peer.key.publicKeyString.get()}@${endpoint ?? peer.endpoints.p2p}`);
    }
    return null;
}
function validateP2PPeer(peer: any) {
    switch (peer.kind) {
        case NodeKind.REPRESENTATIVE:
            {
                if ('certificate' in peer) {
                    /* XXX:TODO */
                    return false;
                }
                if ('signature' in peer) {
                    const signatureWrapperJS = ASN1toJS(peer.signature);
                    if (!Array.isArray(signatureWrapperJS)) {
                        return false;
                    }
                    if (signatureWrapperJS.length !== 2) {
                        return false;
                    }
                    const [checkVersion, checkSignature] = signatureWrapperJS;
                    if (typeof checkVersion !== 'bigint' && typeof checkVersion !== 'number') {
                        return false;
                    }
                    if (BigInt(checkVersion) !== 0n) {
                        return false;
                    }
                    if (!Buffer.isBuffer(checkSignature)) {
                        return false;
                    }
                    const toVerifyJS = [
                        checkVersion,
                        peer.endpoints.p2p,
                        peer.endpoints.api,
                        peer.preferUpdates,
                        peer.kind,
                        peer.key.publicKeyAndType
                    ];
                    const toVerify = JStoASN1(toVerifyJS).toBER();
                    const verification = peer.key.verify(toVerify, checkSignature);
                    return verification;
                }
            }
            return false;
        case NodeKind.PARTICIPANT:
            return undefined;
    }
    return undefined;
}
async function generateP2PPeerSignature(peer: any) {
    switch (peer.kind) {
        case NodeKind.REPRESENTATIVE:
            {
                const version = 0;
                const toSignJS = [
                    version,
                    peer.endpoints.p2p,
                    peer.endpoints.api,
                    peer.preferUpdates,
                    peer.kind,
                    peer.key.publicKeyAndType
                ];
                const toSign = JStoASN1(toSignJS).toBER();
                const signature = await peer.key.sign(toSign);
                const signatureWrapperJS = [version, signature.getBuffer()];
                const signatureWrapper = JStoASN1(signatureWrapperJS).toBER();
                return signatureWrapper;
            }
        case NodeKind.PARTICIPANT:
            return null;
    }
    return null;
}
async function generateP2PPeerSignedCopied(peer: any): Promise<P2PPeer> {
    if (peer.kind === NodeKind.PARTICIPANT) {
        return peer;
    }
    const signature = await generateP2PPeerSignature(peer);
    if (signature === null) {
        throw new Error('Unable to generate signature');
    }
    const retval = {
        ...peer,
        signature
    };
    return retval;
}
function P2PPeerFromJSOCopied(object: any): P2PPeer | null {
    if (object === undefined || object === null) {
        return null;
    }
    if (!(object instanceof Object)) {
        return null;
    }
    if (object.kind === undefined) {
        return null;
    }
    switch (object.kind) {
        case NodeKind.REPRESENTATIVE:
            {
                const endpoints = object.endpoints;
                if (typeof endpoints !== 'object') {
                    return null;
                }
                if (!('p2p' in endpoints) || !('api' in endpoints)) {
                    return null;
                }
                if (typeof endpoints.p2p !== 'string' || typeof endpoints.api !== 'string') {
                    return null;
                }
                if (typeof object.preferUpdates !== 'string') {
                    return null;
                }
                if (object.preferUpdates !== 'http' && object.preferUpdates !== 'websocket') {
                    return null;
                }
                if (typeof object.key !== 'string') {
                    return null;
                }
                const retvalUnsigned = {
                    kind: NodeKind.REPRESENTATIVE,
                    key: Account.fromPublicKeyString(object.key).assertAccount(),
                    endpoints: endpoints,
                    preferUpdates: object.preferUpdates as 'http' | 'websocket'
                };
                let retval;
                if (typeof object.signature === 'string') {
                    try {
                        const signature = bufferToArrayBuffer(Buffer.from(object.signature, 'base64'));
                        retval = {
                            ...retvalUnsigned,
                            signature
                        };
                    }
                    catch {
                        return null;
                    }
                }
                else if (typeof object.certificate === 'string') {
                    retval = {
                        ...retvalUnsigned,
                        certificate: null
                    };
                }
                if (retval === undefined) {
                    return null;
                }
                if (!validateP2PPeer(retval)) {
                    return null;
                }
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                if (!isP2PPeer(retval)) {
                    throw new Error('Invalid peer generated');
                }
                return retval as P2PPeer;
            }
        case NodeKind.PARTICIPANT:
            return ({
                kind: NodeKind.PARTICIPANT,
                id: ''
            });
    }
    return null;
}
function P2PPeerToJSOCopied(peer: any): JSONSerializableObject {
    switch (peer.kind) {
        case NodeKind.REPRESENTATIVE:
            {
                let additionalAttributes;
                if ('signature' in peer) {
                    additionalAttributes = {
                        signature: Buffer.from(peer.signature).toString('base64')
                    };
                    if (additionalAttributes.signature === '') {
                        throw new Error('internal error: signature is required');
                    }
                }
                else if ('certificate' in peer) {
                    additionalAttributes = {
                        certificate: peer.certificate
                    };
                }
                return ({
                    kind: peer.kind,
                    endpoints: peer.endpoints,
                    preferUpdates: peer.preferUpdates,
                    key: peer.key.publicKeyString.get(),
                    ...additionalAttributes
                });
            }
        case NodeKind.PARTICIPANT:
            return ({
                kind: peer.kind
            });
    }
    throw new Error('invalid peer');
}
function isP2PPeer(checkObject: any): checkObject is P2PPeer {
    if (checkObject === undefined || checkObject === null) {
        return false;
    }
    if (!(checkObject instanceof Object)) {
        return false;
    }
    if (!('kind' in checkObject) || checkObject.kind === undefined) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (checkObject.kind) {
        case NodeKind.REPRESENTATIVE:
            if (!('endpoints' in checkObject) || typeof checkObject.endpoints !== 'object') {
                return false;
            }
            if (checkObject.endpoints === null) {
                return false;
            }
            if (!('p2p' in checkObject.endpoints) || !('api' in checkObject.endpoints)) {
                return false;
            }
            if (!('preferUpdates' in checkObject)) {
                return false;
            }
            if (checkObject.preferUpdates !== 'http' && checkObject.preferUpdates !== 'websocket') {
                return false;
            }
            if (!('key' in checkObject)) {
                return false;
            }
            if (!Account.isInstance(checkObject.key)) {
                return false;
            }
            if ('signature' in checkObject) {
                if (!utilTypes.isArrayBuffer(checkObject.signature)) {
                    return false;
                }
            }
            else if ('certificate' in checkObject) {
                if (checkObject.certificate !== null) {
                    return false;
                }
            }
            else {
                return false;
            }
            return true;
        case NodeKind.PARTICIPANT:
            if (!('id' in checkObject) || typeof checkObject.id !== 'string') {
                return false;
            }
            return true;
    }
    return false;
}
function isSerializedConnection(info: any) {
    if (!info || typeof info !== 'object' || Array.isArray(info)) {
        return false;
    }
    if (typeof info.type !== 'string' || typeof info.data !== 'string') {
        return false;
    }
    return true;
}
/**
 * Create an ID for a peer
 */
function peerToID(peer: any) {
    switch (peer.kind) {
        case NodeKind.REPRESENTATIVE:
            return (peer.key.publicKeyString.get());
        case NodeKind.PARTICIPANT: {
            let randomID = '';
            while (randomID.length < 64) {
                const buffer = new Uint8Array(32);
                const randomData = crypto.getRandomValues(buffer);
                const hash = Hash(Buffer.from(randomData));
                randomID += Buffer.from(hash).toString('hex');
            }
            const suffix = randomID.slice(0, 64);
            return `listener_${suffix}`;
        }
        default:
            throw new Error('Only REPRESENTATIVES and PARTICIPANTS supported for now');
    }
}
function randomizeRepsCopied(reps: any) {
    const bias = uuid.v4();
    const randomReps = reps.sort(function (repA: any, repB: any) {
        const repAKey = repA.key.publicKeyAndTypeString;
        const repBKey = repB.key.publicKeyAndTypeString;
        const repAInValue = Buffer.from(`${bias}_${repAKey}`);
        const repBInValue = Buffer.from(`${bias}_${repBKey}`);
        const repAValueHex = Buffer.from(Hash(repAInValue)).toString('hex');
        const repBValueHex = Buffer.from(Hash(repBInValue)).toString('hex');
        const repAValue = BigInt(`0x${repAValueHex}`);
        const repBValue = BigInt(`0x${repBValueHex}`);
        if (repAValue < repBValue) {
            return -1;
        }
        else if (repAValue > repBValue) {
            return 1;
        }
        else {
            return 0;
        }
    });
    return randomReps;
}
function formatRepEndpointsCopied(peers: any) {
    const reps = [];
    for (const peer of peers) {
        if (peer.kind === NodeKind.REPRESENTATIVE) {
            reps.push({
                key: peer.key,
                endpoints: peer.endpoints
            });
        }
    }
    return reps;
}

export const generateP2PPeerSigned: ClientP2P['generateP2PPeerSigned'] = generateP2PPeerSignedCopied;
export const P2PPeerFromJSO: ClientP2P['P2PPeerFromJSO'] = P2PPeerFromJSOCopied;
export const P2PPeerToJSO: ClientP2P['P2PPeerToJSO'] = P2PPeerToJSOCopied;
export const randomizeReps: ClientP2P['randomizeReps'] = randomizeRepsCopied;
export const formatRepEndpoints: ClientP2P['formatRepEndpoints'] = formatRepEndpointsCopied;

export const Testing = {
	isP2PPeer,
	P2PPeerFromJSO,
	generateP2PPeerSigned,
	P2PPeerToJSO
};

/* COPIED FROM CLIENT BUNDLE (MANUAL SYNC) */
export class P2PHttpConnection implements P2PConnection {
    static isInstance: (obj: unknown, strict?: boolean) => obj is P2PHttpConnection =
        checkableGenerator(P2PHttpConnection);
    #switch: P2PSwitch;
    abort = false;
    peer: P2PPeer;
    validatedPeer: P2PPeer | null = null;
    timeout = 0;

    /**
     * Initiate an outbound http connection and attach it to the specified switch
     */
    static async initiate(peer: P2PPeer, p2pSwitch: P2PSwitch): Promise<P2PHttpConnection | null> {
        if (!('endpoints' in peer)) {
            return null;
        }
        if (!('api' in peer.endpoints)) {
            return null;
        }
        if (!('preferUpdates' in peer) || peer.preferUpdates !== 'http') {
            return null;
        }
        const conn = new P2PHttpConnection(peer, p2pSwitch);
        await p2pSwitch.registerConnection(conn);
        return conn;
    }
    constructor(peer: P2PPeer, p2pSwitch: P2PSwitch) {
        this.abort = false;
        this.validatedPeer = null;
        this.timeout = 0;
        this.peer = peer;
        this.#switch = p2pSwitch;
    }
    get connString() {
        if (this.peerString === null) {
            throw new Error('HTTP Connection should have a peerString');
        }
        return this.peerString;
    }
    get peerString() {
        if (this.peer.kind === NodeKind.PARTICIPANT) {
            throw new Error('HTTP Connections cannot be participants');
        }
        return (printablePeer(this.peer, this.peer.endpoints.api));
    }
    async send(messageBuffer: Buffer): Promise<boolean> {
        if (this.peer.kind !== NodeKind.REPRESENTATIVE) {
            return false;
        }
        p2pSwitchLog(this.#switch).debug(`Called send on http connection: ${this.peerString}`);
        const localGreetingInfo = await this.#switch.getOutgoingGreetingInfo();
        const fetchURL = `${this.peer.endpoints.api}/p2p/message`;
        try {
            await fetch(fetchURL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': `KeetaNet/v${version} (JS)`
                },
                body: JSON.stringify({
                    message: messageBuffer.toString(),
                    greeting: localGreetingInfo
                })
            });
        }
        catch (postMessageError) {
            p2pSwitchLog(this.#switch).debug(`Failed to post message: ${postMessageError}`);
        }
        return true;
    }
    async close(): Promise<void> {
        this.abort = true;
        p2pSwitchLog(this.#switch).debug(`Called close on http connection: ${this.peerString}`);
        await this.#switch.unregisterConnection(this);
    }
}


/**
 * A P2PConnection using the "ws" package
 * COPIED FROM CLIENT BUNDLE (MANUAL SYNC)
 */
class P2PWebSocketImpl implements P2PConnection {
	static isInstance: (obj: unknown, strict?: boolean) => obj is P2PWebSocketImpl =
		checkableGenerator(P2PWebSocketImpl);

	abort = false;
	peer: P2PPeer | null = null;
	validatedPeer: P2PPeer | null = null;
	timeout: number;
	#socket: WebSocket;
	#switch: P2PSwitch;
	#underlyingSocket: net.Socket | undefined;

	/**
	 * Initiate an outbound websocket connection and attach it to the specified switch
	 */
	static async initiate(peer: P2PPeer, p2pSwitch: P2PSwitch): Promise<P2PWebSocketImpl | null> {
		if (!('endpoints' in peer)) {
			return null;
		}
		if (!('p2p' in peer.endpoints)) {
			return null;
		}
		let wsAttempt: WebSocket | undefined;
		try {
			/*
			 * Bound the size of a frame the dialed peer may send us
			 * (see P2P_WEBSOCKET_MAX_PAYLOAD_BYTES); the peer is not
			 * trusted merely because we opened the connection.
			 */
			wsAttempt = new WebSocket(peer.endpoints.p2p, {
				maxPayload: P2P_WEBSOCKET_MAX_PAYLOAD_BYTES
			});
		} catch {
			/* Ignore connection error */
		}
		if (wsAttempt === undefined) {
			return null;
		}
		const ws = wsAttempt;
		const socketPromise = new Promise<WebSocket | null>((resolve) => {
			let continueOpen = true;
			let timeoutHandle: ReturnType<typeof setTimeout> | null;
			/**
			 * Function to fail connection
			 */
			const failConnection = function () {
				if (!continueOpen) {
					return;
				}
				timeoutHandle = null;
				continueOpen = false;
				try {
					ws.close();
				} catch {
					/* We ignore this error */
				}
				resolve(null);
			};
			/**
			 * After a timeout, do not proceed with the opening
			 */
			timeoutHandle = setTimeout(failConnection, p2pSwitch.config.timeoutIdleGreeting);
			/**
			 * Wait the connection to be established
			 */
			ws.on('open', function () {
				/**
				 * Pause the websocket until we have an event
				 * handler established for it so we don't miss any messages
				 */
				ws.pause();
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}
				if (!continueOpen) {
					return;
				}
				continueOpen = false;
				resolve(ws);
			});
			ws.on('error', function () {
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}
				failConnection();
			});
		});
		const socket = await socketPromise;
		if (socket === null) {
			return null;
		}
		return await P2PWebSocketImpl.connectToSwitch(socket, p2pSwitch);
	}

	/**
	 * Attach a new "ws" connection to the switch
	 */
	static async connectToSwitch(
		socket: WebSocket,
		p2pSwitch: P2PSwitch,
		underlyingSocket?: net.Socket
	): Promise<P2PWebSocketImpl> {
		const conn = new P2PWebSocketImpl(socket, p2pSwitch, underlyingSocket);
		/**
		 * Handle termination
		 */
		socket.on('close', async () => {
			await p2pSwitch.unregisterConnection(conn);
		});
		socket.on('error', async () => {
			await p2pSwitch.unregisterConnection(conn);
		});
		if (socket.readyState !== socket.OPEN) {
			await new Promise<void>((resolve) => {
				socket.on('open', async () => {
					/**
					 * Register the connection
					 */
					await p2pSwitch.registerConnection(conn);
					resolve();
				});
			});
		} else {
			await p2pSwitch.registerConnection(conn);
		}
		return conn;
	}

	constructor(socket: WebSocket, p2pSwitch: P2PSwitch, underlyingSocket?: net.Socket) {
		if (socket === undefined) {
			throw new Error('internal error: socket is required');
		}
		if (p2pSwitch === undefined) {
			throw new Error('internal error: p2pSwitch is required');
		}
		this.#socket = socket;
		this.#underlyingSocket = underlyingSocket;
		this.peer = null;
		this.abort = false;
		this.#switch = p2pSwitch;
		this.timeout = Date.now() + 100000;
		this.#socket.on('message', async (data) => {
			let chunks: unknown = data;
			if (!Array.isArray(chunks)) {
				chunks = [chunks];
			}
			for (const messageBuffer of chunks as Buffer[]) {
				await this.#switch.recvMessageFromPeer(this, messageBuffer);
			}
		});
		this.#socket.on('close', async () => {
			this.abort = true;
			await this.close();
		});
		this.#socket.on('error', async (error) => {
			this.abort = true;
			p2pSwitchLog(this.#switch).error('Peering error:', error);
			await this.close();
		});
		/**
		 * Resume processing events from the websocket so we can
		 * exchange datagrams
		 */
		this.#socket.resume();
	}

	get connString(): string {
		let connID = this.#socket.url;
		if (connID === undefined) {
			if (this.#underlyingSocket) {
				connID = `inboundws://${this.#underlyingSocket.remoteAddress}:${this.#underlyingSocket.remotePort}`;
			}
		}
		return `${connID}@${this.peerString}`;
	}

	get peerString(): string | null {
		return printablePeer(this.peer);
	}

	async send(messageBuffer: Buffer): Promise<boolean> {
		const promise = new Promise<boolean>((resolve) => {
			if (this.abort) {
				p2pSwitchLog(this.#switch).error('Attempt to send to aborted connection', this.connString);
				resolve(false);
				return;
			}
			this.#socket.send(messageBuffer.toString('utf-8'), async (error) => {
				if (error) {
					p2pSwitchLog(this.#switch).error('Failed to send to', this.connString, error);
					await this.close();
					resolve(false);
				} else {
					resolve(true);
				}
			});
		});
		return await promise;
	}

	async close(): Promise<void> {
		this.abort = true;
		try {
			this.#socket.close();
		} catch {
			/* We ignore this error */
		}
	}
}

export { P2PWebSocketImpl as P2PWebSocket };

export type {
	P2PConfig,
	P2PPeer,
	P2PConnection,
	P2PSwitchStatistics,
	GetPeersOptions
} from '@keetanetwork/keetanet-client/lib/p2p';

type P2PModule = typeof import('./p2p');
type P2PClassKeys = 'P2PSwitch' | 'default' | 'P2PHttpConnection' | 'P2PWebSocket' | 'Testing';
type P2PModulePublic = Omit<P2PModule, P2PClassKeys>;
type ClientP2PPublic = Omit<ClientP2P, P2PClassKeys>;

type _AssertMatchesClient = AssertNever<
	| (P2PModulePublic extends ClientP2PPublic ? never : P2PModulePublic)
	| (ClientP2PPublic extends P2PModulePublic ? never : ClientP2PPublic)
	| (PublicConstructable<typeof P2PHttpConnection> extends PublicConstructable<ClientP2P['P2PHttpConnection']> ? never : PublicConstructable<typeof P2PHttpConnection>)
	| (PublicConstructable<ClientP2P['P2PHttpConnection']> extends PublicConstructable<typeof P2PHttpConnection> ? never : PublicConstructable<ClientP2P['P2PHttpConnection']>)
	| (PublicConstructable<typeof P2PWebSocketImpl> extends PublicConstructable<ClientP2P['P2PWebSocket']> ? never : PublicConstructable<typeof P2PWebSocketImpl>)
	| (PublicConstructable<ClientP2P['P2PWebSocket']> extends PublicConstructable<typeof P2PWebSocketImpl> ? never : PublicConstructable<ClientP2P['P2PWebSocket']>)
>;
