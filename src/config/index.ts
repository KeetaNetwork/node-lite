import { Client } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../lib/utils/never';

const Config = Client.Config;

export const networksArray = Config.networksArray;
export const NetworkIDs = Config.NetworkIDs;
export const baseValidationConfig = Config.baseValidationConfig;
export const getNetworkAlias = Config.getNetworkAlias;
export const getValidation = Config.getValidation;
export const getDefaultConfig = Config.getDefaultConfig;
export const isNetwork = Config.isNetwork;

export type {
	Networks,
	NetworkOrID,
	Endpoints,
	Representative,
	NetworkConfig,
	ValidationConfig
} from '@keetanetwork/keetanet-client/config';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./index') extends typeof import('@keetanetwork/keetanet-client/config') ? never : typeof import('./index'))
	| (typeof import('@keetanetwork/keetanet-client/config') extends typeof import('./index') ? never : typeof import('@keetanetwork/keetanet-client/config'))
>;
