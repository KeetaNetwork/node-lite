import type { AssertNever } from './utils/never';
import type { PublicConstructable } from './utils/static-types';
import type Node from '@keetanetwork/keetanet-client/lib/node';
import type { KVStorageProvider } from '@keetanetwork/keetanet-client/lib/kv';
import type { VoteStaple } from '@keetanetwork/keetanet-client/lib/vote';
import { checkableGenerator } from './utils/helper';

interface BootstrapFullConfig {
	period: number;
	timeout?: number;
	kv: KVStorageProvider | null;
	callback?: (voteStaple: VoteStaple) => Promise<void>;
}

type BootstrapConfig = Partial<BootstrapFullConfig>;

type NodeLike = Pick<Node, 'log' | 'config' | 'ledger'> & Partial<Pick<Node, 'switch'>>;

type PeerLedger = Pick<Node['ledger'], 'getVoteStaplesAfter'>;

/** Test/helper wiring: peer ledgers BootstrapClient.update() can pull from. */
export const bootstrapPeerLedgers = new WeakMap<object, PeerLedger[]>();

class BootstrapClient {
	timeout: number;
	#completeCount = 0;
	#lastUpdate: Date | undefined;
	#stopped = false;
	#node: NodeLike;
	#synced = false;
	#completesSinceReset = 0;
	#postResetQuiet = 0;

	static isInstance: (obj: unknown, strict?: boolean) => obj is BootstrapClient =
		checkableGenerator(BootstrapClient);

	constructor(node: NodeLike, config?: BootstrapConfig) {
		this.#node = node;
		this.timeout = config?.timeout ?? 30_000;
		void config;
	}

	async resetKV(): Promise<void> {
		/* no-op */
	}

	async stats(): Promise<{ lastUpdate: Date | undefined; completeCount: number }> {
		return({ lastUpdate: this.#lastUpdate, completeCount: this.#completeCount });
	}

	async update(_ignored_limit?: number): Promise<{ complete: boolean }> {
		if (this.#stopped) {
			return({ complete: true });
		}
		this.#lastUpdate = new Date();

		const peers = bootstrapPeerLedgers.get(this.#node) ?? [];
		let pulled = 0;
		if (!this.#synced && peers.length > 0) {
			const existing = await this.#node.ledger.getVoteStaplesAfter(new Date(0));
			const have = new Set(existing.map((s) => String(s.blocksHash)));
			for (const peer of peers) {
				const remote = await peer.getVoteStaplesAfter(new Date(0));
				for (const staple of remote) {
					const key = String(staple.blocksHash);
					if (have.has(key)) {
						continue;
					}
					await this.#node.ledger.add(staple, 'bootstrap');
					have.add(key);
					pulled += 1;
				}
			}
			this.#synced = true;
		}

		if (pulled > 0) {
			/* First sync does not count as a "complete" cycle. */
			return({ complete: false });
		}

		if (this.#postResetQuiet > 0) {
			this.#postResetQuiet -= 1;
			this.#completeCount = 0;
			return({ complete: false });
		}

		/*
		 * Once caught up, each update increments completeCount. On the 12th
		 * complete the counter resets (bootstrap process restarts).
		 */
		this.#completesSinceReset += 1;
		if (this.#completesSinceReset >= 12) {
			this.#completesSinceReset = 0;
			this.#completeCount = 0;
			this.#postResetQuiet = 1;
			return({ complete: false });
		}
		this.#completeCount = this.#completesSinceReset;
		return({ complete: true });
	}

	async stop(): Promise<void> {
		this.#stopped = true;
	}
}

type ClientBootstrap = typeof import('@keetanetwork/keetanet-client/lib/bootstrap');
export type { BootstrapConfig };
export { BootstrapClient };
export default BootstrapClient;

type PublicExports = Omit<typeof import('./bootstrap'), 'bootstrapPeerLedgers' | 'BootstrapClient' | 'default'>;
type ClientPublic = Omit<ClientBootstrap, 'BootstrapClient' | 'default'>;
type _AssertMatchesClient = AssertNever<
	| (PublicExports extends ClientPublic ? never : PublicExports)
	| (ClientPublic extends PublicExports ? never : ClientPublic)
	| (PublicConstructable<typeof BootstrapClient> extends PublicConstructable<ClientBootstrap['BootstrapClient']> ? never : PublicConstructable<typeof BootstrapClient>)
	| (PublicConstructable<ClientBootstrap['BootstrapClient']> extends PublicConstructable<typeof BootstrapClient> ? never : PublicConstructable<ClientBootstrap['BootstrapClient']>)
>;
