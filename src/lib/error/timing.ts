import { KeetaNetErrorBase } from './base';
import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';

const TimingErrorType = 'TIMING' as const;

export const TimingErrorCodes = [
	'INVALID_NAME'
] as const;

export const FullTimingErrorCodes = TimingErrorCodes.map(
	(code): `TIMING_${typeof TimingErrorCodes[number]}` => `${TimingErrorType}_${code}`
);

export type TimingErrorCode = typeof FullTimingErrorCodes[number];

class KeetaNetTimingErrorImpl extends KeetaNetErrorBase<TimingErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetTimingErrorImpl =
		checkableGenerator(KeetaNetTimingErrorImpl);

	constructor(code: TimingErrorCode, message: string) {
		super(code, message, { type: TimingErrorType, codes: FullTimingErrorCodes });
	}
}

type ClientTimingError = typeof import('@keetanetwork/keetanet-client/lib/error/timing');
export default KeetaNetTimingErrorImpl;

type TimingErrorExports = typeof import('./timing');
type _AssertMatchesClient = AssertNever<
	| (Omit<TimingErrorExports, 'default'> extends Omit<ClientTimingError, 'default'> ? never : Omit<TimingErrorExports, 'default'>)
	| (Omit<ClientTimingError, 'default'> extends Omit<TimingErrorExports, 'default'> ? never : Omit<ClientTimingError, 'default'>)
	| (PublicConstructable<typeof KeetaNetTimingErrorImpl> extends PublicConstructable<ClientTimingError['default']> ? never : PublicConstructable<typeof KeetaNetTimingErrorImpl>)
	| (PublicConstructable<ClientTimingError['default']> extends PublicConstructable<typeof KeetaNetTimingErrorImpl> ? never : PublicConstructable<ClientTimingError['default']>)
>;
