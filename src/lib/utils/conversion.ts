import { lib } from '@keetanetwork/keetanet-client';

const _mod = lib.Utils.Conversion;

export const toJSONSerializable = _mod.toJSONSerializable;
export const objectToBuffer = _mod.objectToBuffer;
export const parseHexBigIntString = _mod.parseHexBigIntString;

export type {
	JSONSerializable,
	ToJSONSerializable,
	ToJSONSerializableOptions
} from '@keetanetwork/keetanet-client/lib/utils/conversion';

import type { AssertNever } from './never';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./conversion') extends typeof import('@keetanetwork/keetanet-client/lib/utils/conversion') ? never : typeof import('./conversion'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/conversion') extends typeof import('./conversion') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/conversion'))
>;

