import { KeetaNetErrorBase } from './base';
import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';

export const AccountErrorCodes = ["INVALID_PREFIX","INVALID_KEYTYPE","INVALID_KEYTYPE_EXTERNAL","PASSPHRASE_WEAK","INVALID_CONSTRUCTION","NO_IDENTIFIER_SIGN","NO_IDENTIFIER_VERIFY","NOT_ACCOUNT","NOT_IDENTIFIER","INVALID_IDENTIFIER_CONSTRUCTION","SEED_INDEX_UNDEFINED","SEED_INDEX_NEGATIVE","SEED_INDEX_NOT_INT","SEED_INDEX_TOO_LARGE","ENCRYPTION_NOT_SUPPORTED","NAMESPACE_EMPTY","NAMESPACE_TOO_LONG"] as const;
export const FullAccountErrorCodes: ('ACCOUNT_INVALID_PREFIX' | 'ACCOUNT_INVALID_KEYTYPE' | 'ACCOUNT_INVALID_KEYTYPE_EXTERNAL' | 'ACCOUNT_PASSPHRASE_WEAK' | 'ACCOUNT_INVALID_CONSTRUCTION' | 'ACCOUNT_NO_IDENTIFIER_SIGN' | 'ACCOUNT_NO_IDENTIFIER_VERIFY' | 'ACCOUNT_NOT_ACCOUNT' | 'ACCOUNT_NOT_IDENTIFIER' | 'ACCOUNT_INVALID_IDENTIFIER_CONSTRUCTION' | 'ACCOUNT_SEED_INDEX_UNDEFINED' | 'ACCOUNT_SEED_INDEX_NEGATIVE' | 'ACCOUNT_SEED_INDEX_NOT_INT' | 'ACCOUNT_SEED_INDEX_TOO_LARGE' | 'ACCOUNT_ENCRYPTION_NOT_SUPPORTED' | 'ACCOUNT_NAMESPACE_EMPTY' | 'ACCOUNT_NAMESPACE_TOO_LONG')[] = [
	'ACCOUNT_INVALID_PREFIX',
	'ACCOUNT_INVALID_KEYTYPE',
	'ACCOUNT_INVALID_KEYTYPE_EXTERNAL',
	'ACCOUNT_PASSPHRASE_WEAK',
	'ACCOUNT_INVALID_CONSTRUCTION',
	'ACCOUNT_NO_IDENTIFIER_SIGN',
	'ACCOUNT_NO_IDENTIFIER_VERIFY',
	'ACCOUNT_NOT_ACCOUNT',
	'ACCOUNT_NOT_IDENTIFIER',
	'ACCOUNT_INVALID_IDENTIFIER_CONSTRUCTION',
	'ACCOUNT_SEED_INDEX_UNDEFINED',
	'ACCOUNT_SEED_INDEX_NEGATIVE',
	'ACCOUNT_SEED_INDEX_NOT_INT',
	'ACCOUNT_SEED_INDEX_TOO_LARGE',
	'ACCOUNT_ENCRYPTION_NOT_SUPPORTED',
	'ACCOUNT_NAMESPACE_EMPTY',
	'ACCOUNT_NAMESPACE_TOO_LONG'
];
export type AccountErrorCode = typeof FullAccountErrorCodes[number];

export default class KeetaNetAccountError extends KeetaNetErrorBase<AccountErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetAccountError =
		checkableGenerator(KeetaNetAccountError);

	constructor(code: AccountErrorCode, message: string) {
		super(code, message, { type: 'ACCOUNT', codes: FullAccountErrorCodes });
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./account') extends typeof import('@keetanetwork/keetanet-client/lib/error/account') ? never : typeof import('./account'))
	| (typeof import('@keetanetwork/keetanet-client/lib/error/account') extends typeof import('./account') ? never : typeof import('@keetanetwork/keetanet-client/lib/error/account'))
>;
