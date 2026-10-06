import { lib } from '@keetanetwork/keetanet-client';
import KeetaNetBloomError from '../error/bloom';
import type { AssertNever } from './never';

const _mod = lib.Utils.Bloom;

export const BloomFilter = _mod.BloomFilter;
export const serializeBloomFilter = _mod.serializeBloomFilter;

/**
 * Re-throw client bloom transport errors as this package's KeetaNetBloomError
 * so instanceof / isInstance checks against the local class succeed.
 */
export const deserializeBloomFilter: typeof _mod.deserializeBloomFilter = ((input: Parameters<typeof _mod.deserializeBloomFilter>[0]) => {
	try {
		return(_mod.deserializeBloomFilter(input));
	} catch (error) {
		if (
			error !== null &&
			typeof error === 'object' &&
			'code' in error &&
			(error as { code: unknown }).code === 'BLOOM_INVALID_TRANSPORT'
		) {
			const data = 'data' in error ? (error as { data?: unknown }).data : undefined;
			const message = error instanceof Error ? error.message : 'Invalid BloomFilterTransport';
			throw(new KeetaNetBloomError('BLOOM_INVALID_TRANSPORT', message, data));
		}
		throw(error);
	}
}) as typeof _mod.deserializeBloomFilter;

type _AssertMatchesClient = AssertNever<
	| (typeof import('./bloom') extends typeof import('@keetanetwork/keetanet-client/lib/utils/bloom') ? never : typeof import('./bloom'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/bloom') extends typeof import('./bloom') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/bloom'))
>;
