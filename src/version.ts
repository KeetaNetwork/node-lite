export const version = '0.18.7+gf9a01586fd45b1b2f5649176e291ae42384a5cfc';
export default version;

import type { AssertNever } from './lib/utils/never';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./version') extends typeof import('@keetanetwork/keetanet-client/version') ? never : typeof import('./version'))
	| (typeof import('@keetanetwork/keetanet-client/version') extends typeof import('./version') ? never : typeof import('@keetanetwork/keetanet-client/version'))
>;
