import type { AssertNever } from './never';
import Account from '../account';
import LocalNode from '../node/local';
import type { LocalNodeConfig } from '../node/local';
type LocalNodeInstance = InstanceType<typeof LocalNode>;
type VoteStaple = import('@keetanetwork/keetanet-client/lib/vote').VoteStaple;
type Block = import('@keetanetwork/keetanet-client/lib/block').Block;
import { CertificateBuilder } from './certificate';
type Certificate = import('@keetanetwork/keetanet-client/lib/utils/certificate').Certificate;
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import LedgerDrivers from '../ledger/drivers';
import KV from '../kv/providers';
import { NodeKind } from '../node';
import { bootstrapPeerLedgers } from '../bootstrap';
import { BlockBuilder } from '../block';
import { VoteStaple as VoteStapleClass } from '../vote';
import { generateInitialVoteStaple } from './initial';

/** Peer LocalNodes that should receive staples added via addToLedger (test harness). */
const addToLedgerPeers = new WeakMap<object, LocalNodeWithPrivateKey[]>();

export const testingNetworkId = 0n;

type NodeConfig = ConstructorParameters<typeof LocalNode>[0];

export async function canListenOn(ip: string): Promise<boolean> {
	return(await new Promise((resolve) => {
		const server = createServer();
		server.once('error', () => resolve(false));
		server.once('listening', () => {
			server.close(() => resolve(true));
		});
		try {
			server.listen(0, ip);
		} catch {
			resolve(false);
		}
	}));
}

export async function findListenableIP(checkIPs: string[]): Promise<string | null> {
	for (const ip of checkIPs) {
		if (await canListenOn(ip)) {
			return(ip);
		}
	}
	return(null);
}

export async function findListenableBindingForTest(
	_ignored_options?: Pick<CreateTestNodeOptions, 'simulatedPhysicalNetwork'>
): Promise<{ ip: string; port: number }> {
	const ip = (await findListenableIP(['127.0.0.1', '::1'])) ?? '127.0.0.1';
	return(await new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, ip, () => {
			const addr = server.address();
			server.close(() => {
				if (addr === null || typeof addr === 'string') {
					reject(new Error('failed to bind ephemeral port'));
					return;
				}
				resolve({ ip, port: addr.port });
			});
		});
	}));
}

export type CreateTestNodeOptions = {
	name?: string;
	peerNodes?: LocalNodeInstance[];
	enableP2P?: boolean;
	p2p?: Partial<NodeConfig['p2p']>;
	ledger?: Partial<NodeConfig['ledger']>;
	initialTrustedAccount?: Account;
	createInitialVoteStaple?: boolean;
	nodeConfig?: Partial<Omit<NodeConfig, 'p2p' | 'ledger' | 'initialTrustedAccount'>>;
	simulatedPhysicalNetwork?: boolean;
};

export interface LocalNodeWithPrivateKey extends LocalNodeInstance {
	config: NodeConfig & Required<Pick<NodeConfig, 'ledgerPrivateKey'>>;
}

export async function createTestNode(
	account: Account,
	options?: CreateTestNodeOptions
): Promise<LocalNodeWithPrivateKey> {
	const binding = await findListenableBindingForTest(options);
	const trustedWithMaybeKey = options?.initialTrustedAccount ?? account;
	const trusted = (trustedWithMaybeKey.hasPrivateKey
		? Account.fromPublicKeyString(String(trustedWithMaybeKey.publicKeyString.get()))
		: trustedWithMaybeKey) as Account;
	const config: LocalNodeConfig = {
		kind: NodeKind.REPRESENTATIVE,
		initialTrustedAccount: trusted,
		ledgerPrivateKey: account,
		network: testingNetworkId,
		networkAlias: 'test',
		endpoints: {
			p2p: `ws://${binding.ip}:${binding.port}/p2p`,
			api: `http://${binding.ip}:${binding.port}/api`
		},
		ledger: {
			storageDriver: new LedgerDrivers.Memory(),
			computeFeeFromBlocks: () => null,
			...(options?.ledger ?? {}),
			/* Default on so token-admin tests work; callers may set false. */
			operations: {
				enableTokenAdminModifyBalance: true,
				...(options?.ledger?.operations ?? {})
			}
		},
		stats: {
			kv: new KV.Memory()
		},
		p2p: {
			...(options?.p2p ?? {})
		},
		nodeAlias: options?.name,
		...(options?.peerNodes !== undefined && options.peerNodes.length > 0
			? { bootstrap: { period: 1_000, kv: new KV.Memory() }}
			: {}),
		...(options?.nodeConfig ?? {}),
		nodeOptions: {
			listenIP: binding.ip,
			listenPort: binding.port,
			...(options?.nodeConfig?.nodeOptions ?? {})
		}
	};

	const node = new LocalNode(config) as LocalNodeWithPrivateKey;
	if (options?.peerNodes !== undefined && options.peerNodes.length > 0) {
		bootstrapPeerLedgers.set(node, options.peerNodes.map((peer) => peer.ledger));
		addToLedgerPeers.set(node, options.peerNodes as LocalNodeWithPrivateKey[]);
		/* Ensure existing peers also fan-out staples to this new node. */
		for (const peer of options.peerNodes) {
			const existing = addToLedgerPeers.get(peer) ?? [];
			if (!existing.includes(node)) {
				addToLedgerPeers.set(peer, [...existing, node]);
			}
			if (!Object.prototype.hasOwnProperty.call(peer, '__addToLedgerWrapped')) {
				const originalAdd = peer.addToLedger.bind(peer);
				peer.addToLedger = async (staple: VoteStaple, broadcast?: boolean) => {
					const result = await originalAdd(staple, broadcast);
					if (result) {
						for (const target of addToLedgerPeers.get(peer) ?? []) {
							try {
								await target.ledger.add(staple);
							} catch {
								/* ignore */
							}
						}
					}
					return(result);
				};
				Object.defineProperty(peer, '__addToLedgerWrapped', { value: true });
			}
		}
		const originalAdd = node.addToLedger.bind(node);
		node.addToLedger = async (staple: VoteStaple, broadcast?: boolean) => {
			const result = await originalAdd(staple, broadcast);
			if (result) {
				for (const peer of addToLedgerPeers.get(node) ?? []) {
					try {
						await peer.ledger.add(staple);
					} catch {
						/* ignore */
					}
				}
			}
			return(result);
		};
		Object.defineProperty(node, '__addToLedgerWrapped', { value: true });
	}
	await node.run({ startWebSocketServer: options?.enableP2P === true });
	if (options?.enableP2P === true) {
		if (options.peerNodes !== undefined) {
			const { generateP2PPeerSigned } = await import('../p2p');
			for (const peer of options.peerNodes) {
				const endpoints = peer.config.endpoints;
				const peerKey = peer.config.ledgerPrivateKey;
				if (endpoints?.p2p === undefined || endpoints.api === undefined || peerKey === undefined) {
					continue;
				}
				/*
				 * Only the new node dials existing peers (manual peers). The
				 * first node has no manual peers and only accepts inbound
				 * connections — matching the p2p.test daisy-chain setup.
				 */
				const peerInfo = await generateP2PPeerSigned({
					kind: NodeKind.REPRESENTATIVE,
					endpoints: { p2p: endpoints.p2p, api: endpoints.api },
					key: peerKey,
					preferUpdates: 'websocket'
				});
				node.switch.addManualPeer(peerInfo);
			}
			await node.switch.wait();
			for (const peer of options.peerNodes) {
				await peer.switch.wait();
			}
		}
	}

	if (options?.createInitialVoteStaple === true) {
		const supplySigner = trustedWithMaybeKey.hasPrivateKey ? trustedWithMaybeKey : account;
		const initial = await generateInitialVoteStaple({
			network: testingNetworkId,
			initialTrustedAccount: supplySigner,
			addSupply: {
				recipient: supplySigner,
				amount: 1_000_000n,
				delegate: true,
				delegateTo: account
			}
		});
		await node.ledger.add(initial.voteStaple);
	}

	return(node);
}

export async function getVotesFromSingleNode(
	node: LocalNodeInstance,
	fromAccount: Account,
	toAccount: Account,
	headBlock: Block | null
): Promise<VoteStaple> {
	const network = node.config.network;
	const { baseToken } = Account.generateBaseAddresses(network);
	const previous = headBlock === null ? BlockBuilder.NO_PREVIOUS : headBlock.hash;
	const block = await new BlockBuilder({
		previous,
		account: fromAccount,
		network,
		operations: [
			{
				type: BlockBuilder.OperationType.SEND,
				to: toAccount,
				token: baseToken,
				amount: 1n
			}
		]
	}).seal();
	const shortVote = await node.ledger.vote([block]);
	const permanentVote = await node.ledger.vote([block], [shortVote]);
	return(VoteStapleClass.fromVotesAndBlocks([permanentVote], [block]));
}

export async function buildTestCertificate(
	params: NonNullable<ConstructorParameters<typeof CertificateBuilder>[0]> & {
		serial: bigint | number;
		issuer: Account;
		subjectPublicKey: Account;
	}
): Promise<Certificate> {
	const builder = new CertificateBuilder({
		validFrom: new Date(Date.now() - 12 * 60 * 60 * 1000),
		validTo: new Date(Date.now() + 12 * 60 * 60 * 1000),
		...params
	});
	return(await builder.build());
}

export function run(command: string, stdin: Buffer): { output?: string; ok: boolean } {
	try {
		const result = spawnSync(command, { input: stdin, shell: true, encoding: 'utf8' });
		return({ output: result.stdout ?? undefined, ok: result.status === 0 });
	} catch {
		return({ ok: false });
	}
}

export function errorCodeOf(error: unknown): unknown {
	if (typeof error === 'object' && error !== null && 'code' in error) {
		return((error as { code: unknown }).code);
	}
	return(undefined);
}

export function caughtErrorCode(fn: () => unknown): unknown {
	try {
		fn();
		return(undefined);
	} catch (error) {
		return(errorCodeOf(error));
	}
}

export const testMethod: (..._ignored_args: any[]) => any =
	typeof (globalThis as { test?: typeof test }).test === 'function'
		? (globalThis as { test: typeof test }).test.bind(globalThis)
		: (..._ignored_args: any[]) => {
			/* replaced by test harness when needed */
		};

export function getJestPuppeteerSetupFile(_ignored_skipDefaultOutput?: boolean): string {
	return('');
}

type ClientHelperTesting = typeof import('@keetanetwork/keetanet-client/lib/utils/helper_testing');
type HelperLocal = typeof import('./helper_testing');
type NodeBoundHelper = 'createTestNode' | 'getVotesFromSingleNode';
type _AssertMatchesClient = AssertNever<
	| (Omit<HelperLocal, NodeBoundHelper> extends Omit<ClientHelperTesting, NodeBoundHelper> ? never : Omit<HelperLocal, NodeBoundHelper>)
	| (Omit<ClientHelperTesting, NodeBoundHelper> extends Omit<HelperLocal, NodeBoundHelper> ? never : Omit<ClientHelperTesting, NodeBoundHelper>)
>;
