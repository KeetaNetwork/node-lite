import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../utils/never';
import type { ErrorCode } from '@keetanetwork/keetanet-client/lib/error';
import Account from '../account';
import {
	KeetaNetLedgerError,
	KeetaNetLedgerVoteError,
	KeetaNetLedgerIdempotentKeyError
} from './ledger';

const ClientError = lib.Error;
const clientFromJSON = ClientError.fromJSON.bind(ClientError);

/**
 * Run `test` and assert it rejects/throws with the given KeetaNet error code.
 */
export async function ExpectErrorCode(code: ErrorCode, test: () => unknown): Promise<void> {
	let thrown: unknown;
	try {
		const result = test();
		if (result !== undefined && result !== null && typeof (result as Promise<unknown>).then === 'function') {
			await (result as Promise<unknown>);
		}
	} catch (error) {
		thrown = error;
	}

	if (thrown === undefined) {
		throw(new Error(`Expected error code ${code}, but no error was thrown`));
	}

	const actualCode = (thrown as { code?: unknown }).code;
	if (actualCode !== code) {
		throw(new Error(`Expected error code ${code}, got ${String(actualCode)} (${String(thrown)})`));
	}
}

/**
 * Wrap client fromJSON so reconstructed ledger errors are this package's classes
 * (same shape as the client, matching isInstance checks in local tests).
 *
 * Uses a saved clientFromJSON reference — never mutate ClientError.fromJSON.
 */
function fromJSON(json: unknown): ReturnType<typeof clientFromJSON> {
	const result = clientFromJSON(json);
	if (!(result instanceof Error) || !('type' in result) || !('code' in result)) {
		return(result);
	}

	const typed = result as Error & {
		type: string;
		code: string;
		message: string;
		shouldRetry?: boolean;
		retryDelay?: number;
		accounts?: Iterable<{ publicKeyString: { get(): string }}>;
	};

	if (typed.type !== 'LEDGER') {
		return(result);
	}

	if (KeetaNetLedgerVoteError.assertValidLedgerErrorCode(typed.code)) {
		const accounts = new Account.Set();
		if (typed.accounts !== undefined) {
			for (const account of typed.accounts) {
				accounts.add(Account.fromPublicKeyString(account.publicKeyString.get()));
			}
		} else if (json !== null && typeof json === 'object' && 'accounts' in json && Array.isArray((json as { accounts: unknown }).accounts)) {
			for (const key of (json as { accounts: string[] }).accounts) {
				accounts.add(Account.fromPublicKeyString(key));
			}
		}
		return(new KeetaNetLedgerVoteError(typed.code, typed.message, accounts));
	}

	if (KeetaNetLedgerIdempotentKeyError.assertValidLedgerErrorCode(typed.code)) {
		return(result);
	}

	if (KeetaNetLedgerError.assertValidLedgerErrorCode(typed.code)) {
		return(new KeetaNetLedgerError(
			typed.code,
			typed.message,
			typed.shouldRetry ?? false,
			typed.retryDelay
		));
	}

	return(result);
}

type ClientErrorModule = typeof import('@keetanetwork/keetanet-client/lib/error');

export const KeetaNetError = new Proxy(ClientError, {
	get(target, prop, receiver) {
		if (prop === 'fromJSON') {
			return(fromJSON);
		}
		return(Reflect.get(target, prop, receiver));
	}
}) as unknown as ClientErrorModule['KeetaNetError'];

export type { ErrorCode } from '@keetanetwork/keetanet-client/lib/error';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends typeof import('@keetanetwork/keetanet-client/lib/error') ? never : typeof import('./index'))
	| (typeof import('@keetanetwork/keetanet-client/lib/error') extends typeof import('./index') ? never : typeof import('@keetanetwork/keetanet-client/lib/error'))
>;
