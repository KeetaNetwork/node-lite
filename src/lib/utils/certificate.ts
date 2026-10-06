import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './never';

const _mod = lib.Utils.Certificate;

const Certificate = _mod.Certificate;
type Certificate = InstanceType<typeof Certificate>;
const CertificateBuilder = _mod.CertificateBuilder;
type CertificateBuilder = InstanceType<typeof CertificateBuilder>;
const CertificateBundle = _mod.CertificateBundle;
type CertificateBundle = InstanceType<typeof CertificateBundle>;
const CertificateHash = _mod.CertificateHash;
type CertificateHash = InstanceType<typeof CertificateHash>;

export { Certificate, CertificateBuilder, CertificateBundle, CertificateHash };

type _AssertMatchesClient = AssertNever<
	| (typeof import('./certificate') extends typeof import('@keetanetwork/keetanet-client/lib/utils/certificate') ? never : typeof import('./certificate'))
	| (typeof import('@keetanetwork/keetanet-client/lib/utils/certificate') extends typeof import('./certificate') ? never : typeof import('@keetanetwork/keetanet-client/lib/utils/certificate'))
>;
