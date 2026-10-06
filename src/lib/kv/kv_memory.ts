import { KVStorageProviderBase } from './index';
import type { KVStorageProviderAPI, KVSetOptionsType } from './index';
import type { JSONSerializable } from '../utils/conversion';
import type { BufferStorage } from '@keetanetwork/keetanet-client/lib/utils/buffer';
import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';
import KeetaNetKVError from '../error/kv';

type ClientKVMemory = typeof import('@keetanetwork/keetanet-client/lib/kv/kv_memory');

type Entry = {
	value: JSONSerializable;
	expiresAt?: number;
};

function arenaKey(arena: string | null, key: string): string {
	return(`${arena ?? ''}\0${key}`);
}

class KVStorageProviderMemory extends KVStorageProviderBase implements KVStorageProviderAPI {
	#store = new Map<string, Entry>();

	constructor() {
		super();
	}

	#purgeIfExpired(mapKey: string, entry: Entry | undefined): Entry | undefined {
		if (entry === undefined) {
			return(undefined);
		}
		if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
			this.#store.delete(mapKey);
			return(undefined);
		}
		return(entry);
	}

	async set(arena: string, key: string, value: JSONSerializable | undefined, options?: KVSetOptionsType): Promise<void> {
		const mapKey = arenaKey(arena, key);
		if (options?.exclusiveCreate === true && this.#purgeIfExpired(mapKey, this.#store.get(mapKey)) !== undefined) {
			throw(new KeetaNetKVError('KV_KEY_ALREADY_EXISTS', `Key already exists: ${key}`));
		}
		if (value === undefined || value === null) {
			this.#store.delete(mapKey);
			return;
		}
		const entry: Entry = { value };
		if (options?.ttl !== undefined) {
			entry.expiresAt = Date.now() + options.ttl;
		}
		this.#store.set(mapKey, entry);
	}

	async get(arena: string | null, key: string): Promise<JSONSerializable | undefined> {
		const mapKey = arenaKey(arena, key);
		const entry = this.#purgeIfExpired(mapKey, this.#store.get(mapKey));
		return(entry?.value);
	}

	async getAll(arena: string): Promise<{ [key: string]: JSONSerializable }> {
		const prefix = `${arena}\0`;
		const result: { [key: string]: JSONSerializable } = {};
		for (const [mapKey, entry] of this.#store.entries()) {
			if (!mapKey.startsWith(prefix)) {
				continue;
			}
			const live = this.#purgeIfExpired(mapKey, entry);
			if (live === undefined) {
				continue;
			}
			result[mapKey.slice(prefix.length)] = live.value;
		}
		return(result);
	}

	async list(arena: string): Promise<string[]> {
		return(Object.keys(await this.getAll(arena)));
	}

	async incr(arena: string, key: string, change: number): Promise<bigint> {
		const mapKey = arenaKey(arena, key);
		const entry = this.#purgeIfExpired(mapKey, this.#store.get(mapKey));
		let current = 0n;
		if (entry !== undefined) {
			if (typeof entry.value === 'bigint') {
				current = entry.value;
			} else if (typeof entry.value === 'number') {
				current = BigInt(entry.value);
			} else if (typeof entry.value === 'string') {
				current = BigInt(entry.value);
			} else {
				throw(new Error(`Cannot incr non-numeric value at ${key}`));
			}
		}
		const next = current + BigInt(change);
		const asNumber = Number(next);
		const updated: Entry = {
			value: Number.isSafeInteger(asNumber) ? asNumber : next.toString()
		};
		if (entry?.expiresAt !== undefined) {
			updated.expiresAt = entry.expiresAt;
		}
		this.#store.set(mapKey, updated);
		return(next);
	}

	override async xor(arena: null, key: string, change: BufferStorage): Promise<void> {
		const mapKey = arenaKey(arena, key);
		const entry = this.#purgeIfExpired(mapKey, this.#store.get(mapKey));
		const changeBytes = Buffer.from(change.getBuffer());

		let current = Buffer.alloc(changeBytes.length, 0);
		if (entry !== undefined && typeof entry.value === 'string') {
			current = Buffer.from(entry.value, 'hex');
		}
		const length = Math.max(current.length, changeBytes.length);
		const out = Buffer.alloc(length);
		for (let i = 0; i < length; i++) {
			const a = i < current.length ? current[i]! : 0;
			const b = i < changeBytes.length ? changeBytes[i]! : 0;
			out[i] = a ^ b;
		}
		this.#store.set(mapKey, { value: out.toString('hex').toUpperCase() });
	}
}

export { KVStorageProviderMemory };
export default KVStorageProviderMemory;

type _AssertMatchesClient = AssertNever<
	| (PublicConstructable<typeof KVStorageProviderMemory> extends PublicConstructable<ClientKVMemory['KVStorageProviderMemory']> ? never : PublicConstructable<typeof KVStorageProviderMemory>)
	| (PublicConstructable<ClientKVMemory['KVStorageProviderMemory']> extends PublicConstructable<typeof KVStorageProviderMemory> ? never : PublicConstructable<ClientKVMemory['KVStorageProviderMemory']>)
>;
