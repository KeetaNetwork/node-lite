export type * from '@keetanetwork/keetanet-client/lib/ledger/types';

import type { AssertNever } from '../utils/never';
import type { Account, AccountKeyAlgorithm, IdentifierKeyAlgorithm } from '../account';
import type { AccountInfo, ACLPrincipalType } from '@keetanetwork/keetanet-client/lib/ledger/types';
import { KeetaNetLedgerError } from '../error/ledger';

type ClientTypes = typeof import('@keetanetwork/keetanet-client/lib/ledger/types');

/* COPIED FROM CLIENT BUNDLE (MANUAL SYNC) */
export function isIdentifierAccountInfo(
	info: AccountInfo
): info is Extract<AccountInfo, { account: Account<IdentifierKeyAlgorithm> }> {
	return(info.account.isIdentifier());
}

export function isKeyPairAccountInfo(
	info: AccountInfo
): info is Extract<AccountInfo, { account: Account }> {
	return(info.account.isAccount());
}

export function isAccountInfoOfType<T extends AccountKeyAlgorithm>(
	info: AccountInfo,
	type: T
): info is Extract<AccountInfo, { account: Account<T> }> {
	return(info.account.isKeyType(type));
}

const aclPrincipalType = ['ACCOUNT', 'CERTIFICATE'] as const satisfies readonly ACLPrincipalType[];

export function isACLPrincipalType(type: string): type is ACLPrincipalType {
	return((aclPrincipalType as readonly string[]).includes(type));
}

export function assertACLPrincipalType(type: string): asserts type is ACLPrincipalType {
	if (!isACLPrincipalType(type)) {
		throw(new KeetaNetLedgerError('LEDGER_INVALID_ACL_ROW_TYPE', `Invalid ACL Row Type: ${type}`));
	}
}

export function asACLPrincipalType(type: string): ACLPrincipalType {
	assertACLPrincipalType(type);
	return(type);
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./types') extends ClientTypes ? never : typeof import('./types'))
	| (ClientTypes extends typeof import('./types') ? never : ClientTypes)
>;
