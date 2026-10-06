import { KeetaNetErrorBase } from './base';
import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';

export const KVErrorCodes = ['TTL_NOT_SUPPORTED', 'KEY_ALREADY_EXISTS'] as const;
export const FullKVErrorCodes: ('KV_TTL_NOT_SUPPORTED' | 'KV_KEY_ALREADY_EXISTS')[] = [
	'KV_TTL_NOT_SUPPORTED',
	'KV_KEY_ALREADY_EXISTS'
];
export type KVErrorCode = typeof FullKVErrorCodes[number];

export default class KeetaNetKVError extends KeetaNetErrorBase<KVErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetKVError =
		checkableGenerator(KeetaNetKVError);

	constructor(code: KVErrorCode, message: string) {
		super(code, message, { type: 'KV', codes: FullKVErrorCodes });
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./kv') extends typeof import('@keetanetwork/keetanet-client/lib/error/kv') ? never : typeof import('./kv'))
	| (typeof import('@keetanetwork/keetanet-client/lib/error/kv') extends typeof import('./kv') ? never : typeof import('@keetanetwork/keetanet-client/lib/error/kv'))
>;
