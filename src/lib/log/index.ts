import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../utils/never';

const Log = lib.Log;

export default Log;

export type {
	Logger,
	LogTargetLevel,
	LogLevel
} from '@keetanetwork/keetanet-client/lib/log';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends typeof import('@keetanetwork/keetanet-client/lib/log') ? never : typeof import('./index'))
	| (typeof import('@keetanetwork/keetanet-client/lib/log') extends typeof import('./index') ? never : typeof import('@keetanetwork/keetanet-client/lib/log'))
>;
