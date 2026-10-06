import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../utils/never';
import type { GenericAccount } from '@keetanetwork/keetanet-client/lib/account';
import type Node from '@keetanetwork/keetanet-client/lib/node';
import { BufferStorage } from '../utils/buffer';
import { checkableGenerator, setGenerator } from '../utils/helper';
import { StatsPending } from '../stats';
import type { StatsPending as StatsPendingType } from '@keetanetwork/keetanet-client/lib/stats';
import { Hash } from '../utils/hash';

import type LedgerType from '@keetanetwork/keetanet-client/lib/ledger';

const Ledger = lib.Ledger;
type Ledger = LedgerType;

export default Ledger;
export { Ledger };
export const LedgerKind = Ledger.Kind;

export type {
	LedgerConfig,
	LedgerStorage,
	LedgerSelector,
	LedgerStorageAPI,
	PaginatedVotes,
	GetVotesAfterOptions,
	ListACLsByEntityFilters
} from '@keetanetwork/keetanet-client/lib/ledger';

type IdempotentKeyString = string & { readonly __idempotentKey: never };

/**
 * Idempotent key — not exposed on public `lib.Ledger`; implemented from the client .d.ts.
 */
export class IdempotentKey extends BufferStorage {
	readonly account: GenericAccount | undefined;
	readonly userIdempotent: Buffer | undefined;

	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is IdempotentKey =
		checkableGenerator(IdempotentKey);

	static readonly Set = setGenerator(
		IdempotentKey,
		(key: IdempotentKey) => key.toString(),
		(encoded: string) => new IdempotentKey(encoded)
	);

	static fromAccountAndIdempotent(account: GenericAccount, idempotent: string | Buffer): IdempotentKey {
		const idempotentBuffer = typeof idempotent === 'string'
			? Buffer.from(idempotent, 'base64')
			: idempotent;
		const data = Buffer.concat([
			Buffer.from(account.publicKeyAndType),
			idempotentBuffer
		]);
		return(new IdempotentKey(Hash(data), account, idempotentBuffer));
	}

	constructor(
		idempotentKey: ConstructorParameters<typeof BufferStorage>[0],
		account?: GenericAccount,
		idempotent?: Buffer
	) {
		super(idempotentKey, 32);
		this.account = account;
		this.userIdempotent = idempotent;
	}

	override toJSON(): IdempotentKeyString {
		return(this.toString() as IdempotentKeyString);
	}

	override toString(): IdempotentKeyString {
		return(super.toString('hex') as IdempotentKeyString);
	}
}

export interface LedgerStorageTransactionBaseOptions {
	node?: Node;
	moment?: Date;
	identifier: string;
	readOnly?: boolean;
}

export class LedgerStorageTransactionBase implements LedgerStorageTransactionBaseOptions {
	node?: Node;
	moment: Date;
	identifier: string;
	readOnly: boolean;
	statsPending: StatsPendingType;

	constructor(options: LedgerStorageTransactionBaseOptions) {
		this.node = options.node;
		this.moment = options.moment ?? new Date();
		this.identifier = options.identifier;
		this.readOnly = options.readOnly ?? false;
		this.statsPending = new StatsPending();
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends typeof import('@keetanetwork/keetanet-client/lib/ledger') ? never : typeof import('./index'))
	| (typeof import('@keetanetwork/keetanet-client/lib/ledger') extends typeof import('./index') ? never : typeof import('@keetanetwork/keetanet-client/lib/ledger'))
>;

declare module '@keetanetwork/keetanet-client/lib/ledger' {
	interface Ledger {
		_testingRunStorageFunction<T>(
			code: (storage: any, tx: any) => T | Promise<T>
		): Promise<T>;
	}
}
