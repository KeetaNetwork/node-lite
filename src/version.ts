export const version = '0.18.8+gddf8b91a3ac293cc8597bd7a825c17cd46203470';
export default version;

import type { AssertNever } from './lib/utils/never';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./version') extends typeof import('@keetanetwork/keetanet-client/version') ? never : typeof import('./version'))
	| (typeof import('@keetanetwork/keetanet-client/version') extends typeof import('./version') ? never : typeof import('@keetanetwork/keetanet-client/version'))
>;
