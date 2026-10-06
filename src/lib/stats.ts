import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './utils/never';
import type StatsType from '@keetanetwork/keetanet-client/lib/stats';
import type { StatsPending as StatsPendingClass } from '@keetanetwork/keetanet-client/lib/stats';

const Stats: typeof StatsType = lib.Stats;
const StatsPending = Object.getPrototypeOf(Stats) as typeof StatsPendingClass;

export default Stats;
export { Stats, StatsPending };

export type {
	StatsConfig,
	DurationBreakdowns,
	TimeStats,
	DbStats
} from '@keetanetwork/keetanet-client/lib/stats';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./stats') extends typeof import('@keetanetwork/keetanet-client/lib/stats') ? never : typeof import('./stats'))
	| (typeof import('@keetanetwork/keetanet-client/lib/stats') extends typeof import('./stats') ? never : typeof import('@keetanetwork/keetanet-client/lib/stats'))
>;
