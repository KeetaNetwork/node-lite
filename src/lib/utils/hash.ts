import { lib } from '@keetanetwork/keetanet-client';

const _mod = lib.Utils.Hash;

export const Hash = _mod.Hash;
export const HashFunctionName = _mod.HashFunctionName;
export const HashFunctionLength = _mod.HashFunctionLength;

import type { AssertNever } from './never';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./hash') extends typeof import('@keetanetwork/keetanet-client/lib/utils/hash') ? never : typeof import('./hash'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/hash') extends typeof import('./hash') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/hash'))
>;

