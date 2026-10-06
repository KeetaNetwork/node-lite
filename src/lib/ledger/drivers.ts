import DBMemory from './db_memory';
import DBSqlite from './db_sqlite';
import DBPostgres from './db_postgres';
import DBSpanner from './db_spanner';
import type { LedgerStorageAPI } from './index';
import type { AssertNever } from '../utils/never';

type DriverCtor = new () => LedgerStorageAPI;

export const Drivers: { [name: string]: DriverCtor } = {
	Memory: DBMemory,
	SQLite: DBSqlite as unknown as DriverCtor,
	Postgres: DBPostgres as unknown as DriverCtor,
	Spanner: DBSpanner as unknown as DriverCtor
};

export default Drivers;

type _AssertMatchesClient = AssertNever<
	| (typeof import('./drivers') extends typeof import('@keetanetwork/keetanet-client/lib/ledger/drivers') ? never : typeof import('./drivers'))
	| (typeof import('@keetanetwork/keetanet-client/lib/ledger/drivers') extends typeof import('./drivers') ? never : typeof import('@keetanetwork/keetanet-client/lib/ledger/drivers'))
>;
