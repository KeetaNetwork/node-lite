import { lib } from '@keetanetwork/keetanet-client';

const _mod = lib.Utils.Initial;

export const generateInitialVoteStaple = _mod.generateInitialVoteStaple;

import type { AssertNever } from './never';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./initial') extends typeof import('@keetanetwork/keetanet-client/lib/utils/initial') ? never : typeof import('./initial'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/initial') extends typeof import('./initial') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/initial'))
>;

