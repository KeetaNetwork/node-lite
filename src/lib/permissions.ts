import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './utils/never';
import type { Permissions as PermissionsType } from '@keetanetwork/keetanet-client/lib/permissions';

const Permissions = lib.Permissions;
type Permissions = PermissionsType;

export { Permissions };
// Client permissions.d.ts has no default export — named only.

export type {
	BaseFlagName,
	BaseFlagNames,
	AcceptedPermissionTypes,
	BaseSet,
	ExternalSet
} from '@keetanetwork/keetanet-client/lib/permissions';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./permissions') extends typeof import('@keetanetwork/keetanet-client/lib/permissions') ? never : typeof import('./permissions'))
	| (typeof import('@keetanetwork/keetanet-client/lib/permissions') extends typeof import('./permissions') ? never : typeof import('@keetanetwork/keetanet-client/lib/permissions'))
>;
