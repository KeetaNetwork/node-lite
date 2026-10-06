import KVStorageProviderMemory from './kv_memory';
import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';

type ClientKVProviders = typeof import('@keetanetwork/keetanet-client/lib/kv/providers');

class KVStorageProviderRedisUnavailable {
	constructor(..._ignored_args: unknown[]) {
		throw(new Error('not implemented: KV Redis is not included in keetanet-node-lite'));
	}
}

export const KV = {
	Memory: KVStorageProviderMemory,
	Redis: KVStorageProviderRedisUnavailable as unknown as ClientKVProviders['KV']['Redis']
};

export default KV;

type _AssertMatchesClient = AssertNever<
	| (keyof typeof KV extends keyof ClientKVProviders['KV'] ? never : keyof typeof KV)
	| (keyof ClientKVProviders['KV'] extends keyof typeof KV ? never : keyof ClientKVProviders['KV'])
	| (PublicConstructable<typeof KVStorageProviderMemory> extends PublicConstructable<ClientKVProviders['KV']['Memory']> ? never : PublicConstructable<typeof KVStorageProviderMemory>)
	| (PublicConstructable<ClientKVProviders['KV']['Memory']> extends PublicConstructable<typeof KVStorageProviderMemory> ? never : PublicConstructable<ClientKVProviders['KV']['Memory']>)
>;
