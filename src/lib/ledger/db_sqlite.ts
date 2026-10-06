/**
 * SQLite ledger driver is not included in keetanet-node-lite (memory-only).
 */
import type { AssertNever } from '../utils/never';
import { LedgerStorageBase } from './common';
import type { LedgerStorageAPI } from './index';

export interface DBSqliteConfig {
	filename: string;
	retryCount?: number;
}

class DBSqlite extends LedgerStorageBase implements LedgerStorageAPI {
	constructor() {
		super();
		throw(new Error('not implemented: SQLite ledger is not included in keetanet-node-lite'));
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

type ClientDBSqlite = typeof import('@keetanetwork/keetanet-client/lib/ledger/db_sqlite');
const _DBSqlite = DBSqlite as unknown as ClientDBSqlite['DBSqlite'];
export { _DBSqlite as DBSqlite };
export default _DBSqlite;

type _AssertMatchesClient = AssertNever<
	| (typeof import('./db_sqlite') extends ClientDBSqlite ? never : typeof import('./db_sqlite'))
	| (ClientDBSqlite extends typeof import('./db_sqlite') ? never : ClientDBSqlite)
>;
