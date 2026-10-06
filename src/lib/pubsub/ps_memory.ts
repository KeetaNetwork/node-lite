import type { JSONSerializable } from '../utils/conversion';
import type { PubSubProviderAPI, SubscriptionCallback } from './index';
import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';

type ClientPSMemory = typeof import('@keetanetwork/keetanet-client/lib/pubsub/ps_memory');

class PubSubProviderMemory implements PubSubProviderAPI {
	#channels = new Map<string, Set<SubscriptionCallback>>();

	async publish(channel: string, message: JSONSerializable): Promise<void> {
		const subs = this.#channels.get(channel);
		if (!subs) {
			return;
		}
		for (const callback of [...subs]) {
			callback(message);
		}
	}

	async subscribe(channel: string, callback: SubscriptionCallback): Promise<void> {
		let subs = this.#channels.get(channel);
		if (!subs) {
			subs = new Set();
			this.#channels.set(channel, subs);
		}
		subs.add(callback);
	}

	async destroy(): Promise<void> {
		this.#channels.clear();
	}
}

export default PubSubProviderMemory;
export { PubSubProviderMemory };

type _AssertPubSubMemoryMatchesClient = AssertNever<
	| (PublicConstructable<typeof PubSubProviderMemory> extends PublicConstructable<ClientPSMemory['PubSubProviderMemory']> ? never : PublicConstructable<typeof PubSubProviderMemory>)
	| (PublicConstructable<ClientPSMemory['PubSubProviderMemory']> extends PublicConstructable<typeof PubSubProviderMemory> ? never : PublicConstructable<ClientPSMemory['PubSubProviderMemory']>)
>;
