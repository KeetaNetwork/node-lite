import { Client } from '@keetanetwork/keetanet-client';
import type { AssertNever } from '../lib/utils/never';

export const UserClientBuilder = Client.Builder;
export const PendingAccount = UserClientBuilder.PendingAccount;

export type {
	BuilderOptions,
	ManageCertificateMethod
} from '@keetanetwork/keetanet-client/client/builder';

type _AssertMatchesClient = AssertNever<
	| (typeof import('./builder') extends typeof import('@keetanetwork/keetanet-client/client/builder') ? never : typeof import('./builder'))
	| (typeof import('@keetanetwork/keetanet-client/client/builder') extends typeof import('./builder') ? never : typeof import('@keetanetwork/keetanet-client/client/builder'))
>;
