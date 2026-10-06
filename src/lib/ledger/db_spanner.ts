/**
 * Spanner ledger driver is not included in keetanet-node-lite (memory-only).
 */
import type { AssertNever } from '../utils/never';
import { LedgerStorageBase } from './common';
import type { LedgerStorageAPI } from './index';
import type { KVStorageProviderAPI } from '../kv';

export type SpannerConfig = {
	projectId: string;
	instanceId: string;
	databaseId: string;
	kv: KVStorageProviderAPI;
	strongRead?: boolean;
};

class DBSpanner extends LedgerStorageBase implements LedgerStorageAPI {
	constructor() {
		super();
		throw(new Error('not implemented: Spanner ledger is not included in keetanet-node-lite'));
	}

	init(): void { throw(new Error('not implemented')); }
	async destroy(): Promise<void> { throw(new Error('not implemented')); }
	async beginTransaction(): Promise<never> { throw(new Error('not implemented')); }
	async commitTransaction(): Promise<void> { throw(new Error('not implemented')); }
	async abortTransaction(): Promise<void> { throw(new Error('not implemented')); }
	async evaluateError(error: unknown): Promise<unknown> { return(error); }
	async delegatedWeight(): Promise<bigint> { throw(new Error('not implemented')); }
	async getBalance(): Promise<bigint> { throw(new Error('not implemented')); }
	async getAllBalances(): Promise<never> { throw(new Error('not implemented')); }
	async addPendingVote(): Promise<void> { throw(new Error('not implemented')); }
	async getAccountRep(): Promise<null> { throw(new Error('not implemented')); }
	protected async adjustDefer(): Promise<void> { throw(new Error('not implemented')); }
	async listOwners(): Promise<never> { throw(new Error('not implemented')); }
	async listACLsByEntity(): Promise<never> { throw(new Error('not implemented')); }
	async listACLsByPrincipal(): Promise<never> { throw(new Error('not implemented')); }
	async getAccountInfo(): Promise<never> { throw(new Error('not implemented')); }
	async adjust(): Promise<never> { throw(new Error('not implemented')); }
	async getBlock(): Promise<null> { throw(new Error('not implemented')); }
	async getBlockHeight(): Promise<null> { throw(new Error('not implemented')); }
	async getVotes(): Promise<null> { throw(new Error('not implemented')); }
	async getVoteStaples(): Promise<never> { throw(new Error('not implemented')); }
	async getHistory(): Promise<never> { throw(new Error('not implemented')); }
	async getBlockFromPrevious(): Promise<null> { throw(new Error('not implemented')); }
	async getVotesFromMultiplePrevious(): Promise<never> { throw(new Error('not implemented')); }
	async getHeadBlocks(): Promise<never> { throw(new Error('not implemented')); }
	async getVotesAfter(): Promise<never> { throw(new Error('not implemented')); }
	async getAccountCertificates(): Promise<never> { throw(new Error('not implemented')); }
	async getAccountCertificateByHash(): Promise<null> { throw(new Error('not implemented')); }
	protected async gcBatch(): Promise<boolean> { return(false); }
	async getNextSerialNumber(): Promise<bigint> { throw(new Error('not implemented')); }
	async getIdempotentBlockHash(): Promise<null> { throw(new Error('not implemented')); }
	async stats(): Promise<never> { throw(new Error('not implemented')); }
}

const TestingImpl = {
	async createDatabase(_ignored_config: SpannerConfig, _ignored_createInstance: boolean): Promise<never> {
		throw(new Error('not implemented: Spanner ledger is not included in keetanet-node-lite'));
	},
	async deleteDatabase(_ignored_config: SpannerConfig, _ignored_deleteInstance: boolean, _ignored_database: unknown): Promise<void> {
		throw(new Error('not implemented: Spanner ledger is not included in keetanet-node-lite'));
	}
};

type ClientMod = typeof import('@keetanetwork/keetanet-client/lib/ledger/db_spanner');
const _DBSpanner = DBSpanner as unknown as ClientMod['DBSpanner'];
export { _DBSpanner as DBSpanner };
export const Testing = TestingImpl as unknown as ClientMod['Testing'];
export const SpannerTransaction = class {
	constructor(..._ignored_args: unknown[]) {
		throw(new Error('not implemented: SpannerTransaction is not included in keetanet-node-lite'));
	}
} as unknown as ClientMod['SpannerTransaction'];
export default _DBSpanner;

type _AssertMatchesClient = AssertNever<
	| (typeof import('./db_spanner') extends ClientMod ? never : typeof import('./db_spanner'))
	| (ClientMod extends typeof import('./db_spanner') ? never : ClientMod)
>;
