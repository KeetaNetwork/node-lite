/**
 * Asserts that the provided value is never.
 */
export function assertNever(value: never): never {
	throw(new Error(`Unexpected value: ${String(value)}`));
}

/**
 * Asserts that the provided type is never.
 */
export type AssertNever<T extends never> = T;

type _AssertMatchesClient = AssertNever<
	| (typeof import('./never') extends typeof import('@keetanetwork/keetanet-client/lib/utils/never') ? never : typeof import('./never'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/never') extends typeof import('./never') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/never'))
>;
