import { KeetaNetErrorBase } from './base';
import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';
import type Account from '@keetanetwork/keetanet-client/lib/account';
import type { GenericAccount } from '@keetanetwork/keetanet-client/lib/account';
import type { BlockHash } from '@keetanetwork/keetanet-client/lib/block';

const LedgerBaseErrorCodesImpl = [
	'BLOCK_ALREADY_EXISTS', 'BLOCK_EXPIRED', 'TRANSACTION_ABORTED', 'INVALID_CHAIN', 'INVALID_NETWORK',
	'INVALID_SUBNET', 'INVALID_PERMISSIONS', 'INVALID_OWNER_COUNT', 'INVALID_BALANCE', 'INVALID_SET_REP',
	'INVALID_ACL_ROW_TYPE', 'INVALID_DATE', 'OPERATION_NOT_SUPPORTED', 'NOT_EMPTY', 'PREVIOUS_ALREADY_USED',
	'PREVIOUS_NOT_SEEN', 'SUCCESSOR_VOTE_EXISTS', 'INSUFFICIENT_VOTING_WEIGHT', 'INVALID_ACCOUNT_INFO_KEY',
	'RECEIVE_NOT_MET', 'DUPLICATE_VOTE_FOUND', 'CANNOT_EXCHANGE_PERM_VOTE', 'TEMP_VOTE_INCLUDES_SELF',
	'BLOCKS_DIFFER_FROM_VOTED_ON', 'NO_PERM_WITHOUT_SELF_TEMP', 'DUPLICATE_VOTE_ISSUER_FOUND', 'OTHER',
	'MISSING_BLOCKS', 'CERTIFICATE_NOT_FOUND', 'FEE_AMOUNT_MISMATCH', 'FEE_TOKEN_MISMATCH', 'FEE_MISSING',
	'MISSING_REQUIRED_FEE_BLOCK', 'MULTIPLE_FEE_BLOCK', 'VOTE_WITH_QUOTE', 'QUOTE_MISMATCH', 'REQUIRED_FEE_MISMATCH'
] as const;

const LedgerVoteErrorCodesImpl = ['NOT_SUCCESSOR', 'NOT_OPENING'] as const;
const LedgerIdempotentKeyErrorCodesImpl = ['IDEMPOTENT_KEY_EXISTS'] as const;

const FullLedgerBaseErrorCodeImpl = LedgerBaseErrorCodesImpl.map(
	(code): `LEDGER_${typeof LedgerBaseErrorCodesImpl[number]}` => `LEDGER_${code}`
);

const FullLedgerVoteErrorCodesImpl: ('LEDGER_NOT_SUCCESSOR' | 'LEDGER_NOT_OPENING')[] = [
	'LEDGER_NOT_SUCCESSOR',
	'LEDGER_NOT_OPENING'
];

const FullLedgerIdempotentKeyErrorCodesImpl: 'LEDGER_IDEMPOTENT_KEY_EXISTS'[] = [
	'LEDGER_IDEMPOTENT_KEY_EXISTS'
];

const FullLedgerErrorCodesImpl: LedgerErrorCode[] = [
	...FullLedgerBaseErrorCodeImpl,
	...FullLedgerVoteErrorCodesImpl,
	...FullLedgerIdempotentKeyErrorCodesImpl
];

export type LedgerBaseErrorCode = `LEDGER_${typeof LedgerBaseErrorCodesImpl[number]}`;
export type LedgerVoteErrorCode = typeof FullLedgerVoteErrorCodesImpl[number];
export type LedgerIdempotentKeyErrorCode = typeof FullLedgerIdempotentKeyErrorCodesImpl[number];
export type LedgerErrorCode = LedgerBaseErrorCode | LedgerVoteErrorCode | LedgerIdempotentKeyErrorCode;

class KeetaNetLedgerErrorImpl extends KeetaNetErrorBase<LedgerBaseErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetLedgerErrorImpl =
		checkableGenerator(KeetaNetLedgerErrorImpl);

	static assertValidLedgerErrorCode(code: string): code is LedgerBaseErrorCode {
		return((FullLedgerBaseErrorCodeImpl as string[]).includes(code));
	}

	override readonly type = 'LEDGER' as const;
	readonly shouldRetry: boolean;
	readonly retryDelay?: number;

	constructor(code: LedgerBaseErrorCode, message: string, shouldRetry = false, retryDelay?: number) {
		super(code, message, { type: 'LEDGER', codes: FullLedgerBaseErrorCodeImpl });
		this.shouldRetry = shouldRetry;
		this.retryDelay = retryDelay;
	}
}

class KeetaNetLedgerVoteErrorImpl extends KeetaNetErrorBase<LedgerVoteErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetLedgerVoteErrorImpl =
		checkableGenerator(KeetaNetLedgerVoteErrorImpl);

	static assertValidLedgerErrorCode(code: string): code is LedgerVoteErrorCode {
		return((FullLedgerVoteErrorCodesImpl as string[]).includes(code));
	}

	readonly accounts: InstanceType<typeof Account.Set>;
	override readonly type = 'LEDGER' as const;
	readonly shouldRetry = false as const;

	constructor(code: LedgerVoteErrorCode, message: string, accounts: InstanceType<typeof Account.Set>) {
		super(code, message, { type: 'LEDGER', codes: FullLedgerVoteErrorCodesImpl });
		this.accounts = accounts;
	}

	override toJSON() {
		return({
			...super.toJSON(),
			accounts: [...this.accounts].map((account) => account.publicKeyString.get())
		});
	}
}

class KeetaNetLedgerIdempotentKeyErrorImpl extends KeetaNetErrorBase<LedgerIdempotentKeyErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetLedgerIdempotentKeyErrorImpl =
		checkableGenerator(KeetaNetLedgerIdempotentKeyErrorImpl);

	static assertValidLedgerErrorCode(code: string): code is LedgerIdempotentKeyErrorCode {
		return((FullLedgerIdempotentKeyErrorCodesImpl as string[]).includes(code));
	}

	override readonly type = 'LEDGER' as const;
	readonly shouldRetry = false as const;
	readonly account?: GenericAccount;
	readonly idempotentKey?: ArrayBuffer;
	readonly blockhash: BlockHash;
	readonly existingBlockhash: BlockHash;

	constructor(
		code: LedgerIdempotentKeyErrorCode,
		blockhash: BlockHash,
		existingBlockhash: BlockHash,
		account?: GenericAccount,
		idempotentKey?: ArrayBuffer | Buffer
	) {
		super(code, 'Idempotent key already exists', { type: 'LEDGER', codes: FullLedgerIdempotentKeyErrorCodesImpl });
		this.blockhash = blockhash;
		this.existingBlockhash = existingBlockhash;
		this.account = account;
		if (idempotentKey === undefined) {
			this.idempotentKey = undefined;
		} else if (Buffer.isBuffer(idempotentKey)) {
			const copy = new Uint8Array(idempotentKey.byteLength);
			copy.set(idempotentKey);
			this.idempotentKey = copy.buffer;
		} else {
			this.idempotentKey = idempotentKey;
		}
	}

	override toJSON() {
		return({
			...super.toJSON(),
			blockhash: this.blockhash.toJSON(),
			existingBlockhash: this.existingBlockhash.toJSON(),
			...(this.account === undefined ? {} : { account: String(this.account.publicKeyString.get()) }),
			...(this.idempotentKey === undefined
				? {}
				: { idempotentKey: Buffer.from(this.idempotentKey).toString('hex') })
		});
	}
}

type ClientLedgerError = typeof import('@keetanetwork/keetanet-client/lib/error/ledger');
export const LedgerBaseErrorCodes = LedgerBaseErrorCodesImpl;
export const LedgerVoteErrorCodes = LedgerVoteErrorCodesImpl;
export const LedgerIdempotentKeyErrorCodes = LedgerIdempotentKeyErrorCodesImpl;
export const FullLedgerBaseErrorCode = FullLedgerBaseErrorCodeImpl;
export const FullLedgerVoteErrorCodes = FullLedgerVoteErrorCodesImpl;
export const FullLedgerIdempotentKeyErrorCodes = FullLedgerIdempotentKeyErrorCodesImpl;
export const FullLedgerErrorCodes = FullLedgerErrorCodesImpl;
export { KeetaNetLedgerErrorImpl as KeetaNetLedgerError };
export { KeetaNetLedgerVoteErrorImpl as KeetaNetLedgerVoteError };
export { KeetaNetLedgerIdempotentKeyErrorImpl as KeetaNetLedgerIdempotentKeyError };

type LedgerErrorExports = typeof import('./ledger');
type _AssertMatchesClient = AssertNever<
	| (Omit<LedgerErrorExports, 'KeetaNetLedgerError' | 'KeetaNetLedgerVoteError' | 'KeetaNetLedgerIdempotentKeyError'> extends Omit<ClientLedgerError, 'KeetaNetLedgerError' | 'KeetaNetLedgerVoteError' | 'KeetaNetLedgerIdempotentKeyError'> ? never : Omit<LedgerErrorExports, 'KeetaNetLedgerError' | 'KeetaNetLedgerVoteError' | 'KeetaNetLedgerIdempotentKeyError'>)
	| (Omit<ClientLedgerError, 'KeetaNetLedgerError' | 'KeetaNetLedgerVoteError' | 'KeetaNetLedgerIdempotentKeyError'> extends Omit<LedgerErrorExports, 'KeetaNetLedgerError' | 'KeetaNetLedgerVoteError' | 'KeetaNetLedgerIdempotentKeyError'> ? never : Omit<ClientLedgerError, 'KeetaNetLedgerError' | 'KeetaNetLedgerVoteError' | 'KeetaNetLedgerIdempotentKeyError'>)
	| (PublicConstructable<typeof KeetaNetLedgerErrorImpl> extends PublicConstructable<ClientLedgerError['KeetaNetLedgerError']> ? never : PublicConstructable<typeof KeetaNetLedgerErrorImpl>)
	| (PublicConstructable<ClientLedgerError['KeetaNetLedgerError']> extends PublicConstructable<typeof KeetaNetLedgerErrorImpl> ? never : PublicConstructable<ClientLedgerError['KeetaNetLedgerError']>)
	| (PublicConstructable<typeof KeetaNetLedgerVoteErrorImpl> extends PublicConstructable<ClientLedgerError['KeetaNetLedgerVoteError']> ? never : PublicConstructable<typeof KeetaNetLedgerVoteErrorImpl>)
	| (PublicConstructable<ClientLedgerError['KeetaNetLedgerVoteError']> extends PublicConstructable<typeof KeetaNetLedgerVoteErrorImpl> ? never : PublicConstructable<ClientLedgerError['KeetaNetLedgerVoteError']>)
	| (PublicConstructable<typeof KeetaNetLedgerIdempotentKeyErrorImpl> extends PublicConstructable<ClientLedgerError['KeetaNetLedgerIdempotentKeyError']> ? never : PublicConstructable<typeof KeetaNetLedgerIdempotentKeyErrorImpl>)
	| (PublicConstructable<ClientLedgerError['KeetaNetLedgerIdempotentKeyError']> extends PublicConstructable<typeof KeetaNetLedgerIdempotentKeyErrorImpl> ? never : PublicConstructable<ClientLedgerError['KeetaNetLedgerIdempotentKeyError']>)
>;
