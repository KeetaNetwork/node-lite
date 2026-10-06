import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './never';

const Helper = lib.Utils.Helper;

export const AsyncDisposableStack = Helper.AsyncDisposableStack;
export const crypto = Helper.crypto;
export const util = Helper.util;
export const getTypedObjectEntries = Helper.getTypedObjectEntries;
export const validateBase64ToBuffer = Helper.validateBase64ToBuffer;
export const bufferToArrayBuffer = Helper.bufferToArrayBuffer;
export const bufferToBigInt = Helper.bufferToBigInt;
export const isIntegerOrBigInt = Helper.isIntegerOrBigInt;
export const isBuffer = Helper.isBuffer;
export const arrayRepeat = Helper.arrayRepeat;
export const waitTicks = Helper.waitTicks;
export const env = Helper.env;
export const booleanEnv = Helper.booleanEnv;
export const randomString = Helper.randomString;
export const randomInt = Helper.randomInt;
export const asleep = Helper.asleep;
export const promiseGenerator = Helper.promiseGenerator;
export const objectToBuffer = Helper.objectToBuffer;
export const debugPrintableObject = Helper.debugPrintableObject;
export const checkableGenerator = Helper.checkableGenerator;
export const nonNullable = Helper.nonNullable;
export const setGenerator = Helper.setGenerator;

export type {
	DistributiveOmit,
	DeepMutable,
	InstanceSetConstructor
} from '@keetanetwork/keetanet-client/lib/utils/helper';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./helper') extends typeof import('@keetanetwork/keetanet-client/lib/utils/helper') ? never : typeof import('./helper'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/helper') extends typeof import('./helper') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/helper'))
>;
