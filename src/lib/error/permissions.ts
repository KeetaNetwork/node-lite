import { KeetaNetErrorBase } from './base';
import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';

export const PermissionsErrorCodes = ["CANNOT_MIX_FLAGS_AND_TYPES","EXTERNAL_OFFSET_TOO_LARGE","INVALID_EXTERNAL_FLAG","INVALID_FLAG","INVALID_FLAG_ASSERTION"] as const;
export const FullPermissionsErrorCodes: ('PERMISSIONS_CANNOT_MIX_FLAGS_AND_TYPES' | 'PERMISSIONS_EXTERNAL_OFFSET_TOO_LARGE' | 'PERMISSIONS_INVALID_EXTERNAL_FLAG' | 'PERMISSIONS_INVALID_FLAG' | 'PERMISSIONS_INVALID_FLAG_ASSERTION')[] = [
	'PERMISSIONS_CANNOT_MIX_FLAGS_AND_TYPES',
	'PERMISSIONS_EXTERNAL_OFFSET_TOO_LARGE',
	'PERMISSIONS_INVALID_EXTERNAL_FLAG',
	'PERMISSIONS_INVALID_FLAG',
	'PERMISSIONS_INVALID_FLAG_ASSERTION'
];
export type PermissionsErrorCode = typeof FullPermissionsErrorCodes[number];

export default class KeetaNetPermissionsError extends KeetaNetErrorBase<PermissionsErrorCode> {
	static override readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetPermissionsError =
		checkableGenerator(KeetaNetPermissionsError);

	constructor(code: PermissionsErrorCode, message: string) {
		super(code, message, { type: 'PERMISSIONS', codes: FullPermissionsErrorCodes });
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./permissions') extends typeof import('@keetanetwork/keetanet-client/lib/error/permissions') ? never : typeof import('./permissions'))
	| (typeof import('@keetanetwork/keetanet-client/lib/error/permissions') extends typeof import('./permissions') ? never : typeof import('@keetanetwork/keetanet-client/lib/error/permissions'))
>;
