import { KeetaNetErrorBase } from './base';
import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';

export const APIErrorCodes = ["INVALID_LIMIT","INVALID_SIDE","INVALID_START","LIMIT_NOT_NUMBER","LIMIT_NOT_GREATER_THAN_ZERO","REP_MISSING","START_MISSING"] as const;
export const FullAPIErrorCodes: ('API_INVALID_LIMIT' | 'API_INVALID_SIDE' | 'API_INVALID_START' | 'API_LIMIT_NOT_NUMBER' | 'API_LIMIT_NOT_GREATER_THAN_ZERO' | 'API_REP_MISSING' | 'API_START_MISSING')[] = [
	'API_INVALID_LIMIT',
	'API_INVALID_SIDE',
	'API_INVALID_START',
	'API_LIMIT_NOT_NUMBER',
	'API_LIMIT_NOT_GREATER_THAN_ZERO',
	'API_REP_MISSING',
	'API_START_MISSING'
];
export type APIErrorCode = typeof FullAPIErrorCodes[number];

export default class KeetaNetAPIError extends KeetaNetErrorBase<APIErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetAPIError =
		checkableGenerator(KeetaNetAPIError);

	constructor(code: APIErrorCode, message: string) {
		super(code, message, { type: 'API', codes: FullAPIErrorCodes });
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./api') extends typeof import('@keetanetwork/keetanet-client/lib/error/api') ? never : typeof import('./api'))
	| (typeof import('@keetanetwork/keetanet-client/lib/error/api') extends typeof import('./api') ? never : typeof import('@keetanetwork/keetanet-client/lib/error/api'))
>;
