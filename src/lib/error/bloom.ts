import { KeetaNetErrorBase } from './base';
import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';

export const BloomErrorCodes = ['INVALID_TRANSPORT'] as const;
export const FullBloomErrorCodes: 'BLOOM_INVALID_TRANSPORT'[] = ['BLOOM_INVALID_TRANSPORT'];
export type BloomErrorCode = typeof FullBloomErrorCodes[number];

export default class KeetaNetBloomError extends KeetaNetErrorBase<BloomErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetBloomError =
		checkableGenerator(KeetaNetBloomError);

	readonly data?: unknown;

	constructor(code: BloomErrorCode, message: string, data?: unknown) {
		super(code, message, { type: 'BLOOM', codes: FullBloomErrorCodes });
		this.data = data;
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./bloom') extends typeof import('@keetanetwork/keetanet-client/lib/error/bloom') ? never : typeof import('./bloom'))
	| (typeof import('@keetanetwork/keetanet-client/lib/error/bloom') extends typeof import('./bloom') ? never : typeof import('@keetanetwork/keetanet-client/lib/error/bloom'))
>;
