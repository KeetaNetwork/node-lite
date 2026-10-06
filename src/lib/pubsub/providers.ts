import PubSubProviderMemory from './ps_memory';
import PubSubProviderRedis from './ps_redis';
import PubSubProviderGCP from './ps_gcp';
import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';

type ClientPSProviders = typeof import('@keetanetwork/keetanet-client/lib/pubsub/providers');

export const PS = {
	Memory: PubSubProviderMemory,
	Redis: PubSubProviderRedis,
	GCP: PubSubProviderGCP
};

export default PS;

type _AssertPubSubProvidersMatchesClient = AssertNever<
	| (keyof typeof PS extends keyof ClientPSProviders['PS'] ? never : keyof typeof PS)
	| (keyof ClientPSProviders['PS'] extends keyof typeof PS ? never : keyof ClientPSProviders['PS'])
	| (PublicConstructable<typeof PubSubProviderMemory> extends PublicConstructable<ClientPSProviders['PS']['Memory']> ? never : PublicConstructable<typeof PubSubProviderMemory>)
	| (PublicConstructable<ClientPSProviders['PS']['Memory']> extends PublicConstructable<typeof PubSubProviderMemory> ? never : PublicConstructable<ClientPSProviders['PS']['Memory']>)
>;
