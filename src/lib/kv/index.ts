import { randomUUID } from 'crypto';
import type { BufferStorage } from '@keetanetwork/keetanet-client/lib/utils/buffer';
import type { AssertNever } from '../utils/never';
import type { KVGenericOptionsType } from '@keetanetwork/keetanet-client/lib/kv';

export type {
	KVGenericOptionsType,
	KVSetOptionsType,
	KVStorageProviderAPI,
	KVStorageProvider
} from '@keetanetwork/keetanet-client/lib/kv';

export class KVStorageProviderBase {
	readonly id: `${string}-${string}-${string}-${string}-${string}` = randomUUID() as `${string}-${string}-${string}-${string}-${string}`;

	xor(
		_ignored_arena: null,
		_ignored_key: string,
		_ignored_change: BufferStorage,
		_ignored_options?: KVGenericOptionsType
	): Promise<void> {
		throw(new Error('not implemented'));
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends typeof import('@keetanetwork/keetanet-client/lib/kv') ? never : typeof import('./index'))
	| (typeof import('@keetanetwork/keetanet-client/lib/kv') extends typeof import('./index') ? never : typeof import('@keetanetwork/keetanet-client/lib/kv'))
>;
