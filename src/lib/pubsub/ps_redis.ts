import type { AssertNever } from '../utils/never';
import type { JSONSerializable } from '../utils/conversion';
import type { PubSubProviderAPI, SubscriptionCallback } from './index';

type ClientPSRedis = typeof import('@keetanetwork/keetanet-client/lib/pubsub/ps_redis');

/**
 * Redis PubSub provider is not included in keetanet-node-lite.
 */
class PubSubProviderRedisImpl implements PubSubProviderAPI {
	constructor(_ignored_host: string, _ignored_password: string, _ignored_port?: number) {
		throw(new Error('not implemented: PubSub Redis is not included in keetanet-node-lite'));
	}

	async publish(_ignored_channel: string, _ignored_message: JSONSerializable): Promise<void> {
		throw(new Error('not implemented'));
	}

	async subscribe(_ignored_channel: string, _ignored_callback: SubscriptionCallback): Promise<void> {
		throw(new Error('not implemented'));
	}

	async destroy(): Promise<void> {
		throw(new Error('not implemented'));
	}
}

const PubSubProviderRedis = PubSubProviderRedisImpl as unknown as ClientPSRedis['default'];
export { PubSubProviderRedis };
export default PubSubProviderRedis;

type _AssertMatchesClient = AssertNever<
	| (typeof import('./ps_redis') extends ClientPSRedis ? never : typeof import('./ps_redis'))
	| (ClientPSRedis extends typeof import('./ps_redis') ? never : ClientPSRedis)
>;
