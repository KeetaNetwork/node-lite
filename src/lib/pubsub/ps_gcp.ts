import type { AssertNever } from '../utils/never';
import type { JSONSerializable } from '../utils/conversion';
import type { PubSubProviderAPI, SubscriptionCallback } from './index';

type ClientGCP = typeof import('@keetanetwork/keetanet-client/lib/pubsub/ps_gcp');

/**
 * GCP PubSub provider is not included in keetanet-node-lite.
 */
class PubSubProviderGCPImpl implements PubSubProviderAPI {
	constructor(_ignored_projectId: string, _ignored_apiEndpoint?: string) {
		throw(new Error('not implemented: PubSub GCP is not included in keetanet-node-lite'));
	}

	get _testing_pubsub(): never {
		throw(new Error('not implemented'));
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

	async assertTopicExists(_ignored_topic: unknown, _ignored_channel: string): Promise<true | undefined> {
		throw(new Error('not implemented'));
	}
}

export const PubSubProviderGCP = PubSubProviderGCPImpl as unknown as ClientGCP['PubSubProviderGCP'];
export default PubSubProviderGCP;

/** Test-only helper (not on the client public surface). GCP is unsupported in lite. */
export async function _testingGcpPubSubSetup(
	_ignored_project: string,
	_ignored_channel: string,
	_ignored_emulatorHost?: string
): Promise<PubSubProviderAPI> {
	throw(new Error('not implemented: GCP PubSub is not included in keetanet-node-lite'));
}

type PublicExports = Omit<typeof import('./ps_gcp'), '_testingGcpPubSubSetup'>;
type _AssertMatchesClient = AssertNever<
	| (PublicExports extends ClientGCP ? never : PublicExports)
	| (ClientGCP extends PublicExports ? never : ClientGCP)
>;
