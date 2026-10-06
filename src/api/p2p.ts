import type { AssertNever } from '../lib/utils/never';
import type { APIRequest } from './index';

async function handleMessage(_ignored_request: APIRequest, _ignored_payload: {
	message: string;
	greeting: object;
}): Promise<{ success: boolean }> {
	return({ success: true });
}

const p2p = {
	message: {
		POST: handleMessage
	}
};

export default p2p;

type ClientP2P = typeof import('@keetanetwork/keetanet-client/api/p2p');
type _AssertMatchesClient = AssertNever<
	| (typeof import('./p2p') extends ClientP2P ? never : typeof import('./p2p'))
	| (ClientP2P extends typeof import('./p2p') ? never : ClientP2P)
>;
