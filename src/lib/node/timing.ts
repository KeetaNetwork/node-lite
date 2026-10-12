import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';

type ClientTiming = typeof import('@keetanetwork/keetanet-client/lib/node/timing');

/**
 * Request timing — re-exported from keetanet-client (includes toServerTimingHeader).
 */
const RequestTiming = lib.Timing.RequestTiming;

export { RequestTiming };
export default RequestTiming;

type _AssertMatchesClient = AssertNever<
	| (PublicConstructable<typeof RequestTiming> extends PublicConstructable<ClientTiming['RequestTiming']> ? never : PublicConstructable<typeof RequestTiming>)
	| (PublicConstructable<ClientTiming['RequestTiming']> extends PublicConstructable<typeof RequestTiming> ? never : PublicConstructable<ClientTiming['RequestTiming']>)
>;
