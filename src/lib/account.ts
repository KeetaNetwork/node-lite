import { lib } from '@keetanetwork/keetanet-client';
import type { AssertNever } from './utils/never';
import type AccountType from '@keetanetwork/keetanet-client/lib/account';
import { BufferStorage } from './utils/buffer';
import { checkableGenerator } from './utils/helper';

const Account = lib.Account;
type Account<
	T extends import('@keetanetwork/keetanet-client/lib/account').AccountKeyAlgorithm =
	import('@keetanetwork/keetanet-client/lib/account').KeyPairKeyAlgorithm
> = AccountType<T>;

export default Account;
export { Account };
export const AccountKeyAlgorithm = Account.AccountKeyAlgorithm;
export type AccountKeyAlgorithm = import('@keetanetwork/keetanet-client/lib/account').AccountKeyAlgorithm;
export const ExternalKeyPair = Account.ExternalKeyPair;

export type {
	GenericAccount,
	TokenAddress,
	StorageAddress,
	NetworkAddress,
	MultisigAddress,
	IdentifierAddress,
	NonIdentifierAccount,
	IdentifierKeyAlgorithm,
	KeyPairKeyAlgorithm,
	PublicKeyStringMapping,
	AccountPublicKeyString
} from '@keetanetwork/keetanet-client/lib/account';

/**
 * Minimal stand-ins for account internal storage/key classes used by tests
 * that verify checkableGenerator / isInstance discrimination. These are not
 * part of the published client .d.ts surface.
 */
class SeedStorage extends BufferStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is SeedStorage =
		checkableGenerator(SeedStorage);

	constructor(key: ConstructorParameters<typeof BufferStorage>[0]) {
		super(key, 36);
	}
}

class KeyStorage extends BufferStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is KeyStorage =
		checkableGenerator(KeyStorage);

	constructor(key: ConstructorParameters<typeof BufferStorage>[0]) {
		super(key, 32);
	}
}

class SignatureStorage extends BufferStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is SignatureStorage =
		checkableGenerator(SignatureStorage);

	constructor(signature: ConstructorParameters<typeof BufferStorage>[0]) {
		super(signature, 64);
	}
}

class ECDSASECP256K1PrivateKey extends KeyStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256K1PrivateKey =
		checkableGenerator(ECDSASECP256K1PrivateKey);
}

class ECDSASECP256R1PrivateKey extends KeyStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256R1PrivateKey =
		checkableGenerator(ECDSASECP256R1PrivateKey);
}

class ED25519PrivateKey extends KeyStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ED25519PrivateKey =
		checkableGenerator(ED25519PrivateKey);
}

class ECDSASECP256K1PublicKey extends BufferStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256K1PublicKey =
		checkableGenerator(ECDSASECP256K1PublicKey);

	constructor(key: ConstructorParameters<typeof BufferStorage>[0]) {
		super(key, 33);
	}
}

class ECDSASECP256R1PublicKey extends BufferStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256R1PublicKey =
		checkableGenerator(ECDSASECP256R1PublicKey);

	constructor(key: ConstructorParameters<typeof BufferStorage>[0]) {
		super(key, 33);
	}
}

class ED25519PublicKey extends BufferStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ED25519PublicKey =
		checkableGenerator(ED25519PublicKey);

	constructor(key: ConstructorParameters<typeof BufferStorage>[0]) {
		super(key, 32);
	}
}

class ECDSASECP256K1Signature extends SignatureStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256K1Signature =
		checkableGenerator(ECDSASECP256K1Signature);
}

class ECDSASECP256R1Signature extends SignatureStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256R1Signature =
		checkableGenerator(ECDSASECP256R1Signature);
}

class ED25519Signature extends SignatureStorage {
	static override isInstance: (obj: unknown, strict?: boolean) => obj is ED25519Signature =
		checkableGenerator(ED25519Signature);
}

class PublicKeyString {
	static isInstance: (obj: unknown, strict?: boolean) => obj is PublicKeyString =
		checkableGenerator(PublicKeyString);

	readonly #value: string;

	constructor(publicKeyString: string) {
		this.#value = publicKeyString;
	}

	toString(): string {
		return(this.#value);
	}
}

class ECDSASECP256K1KeyPair {
	static isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256K1KeyPair =
		checkableGenerator(ECDSASECP256K1KeyPair);

	constructor(_ignored_privateKey: ConstructorParameters<typeof BufferStorage>[0]) {
		/* test helper only */
	}
}

class ECDSASECP256R1KeyPair {
	static isInstance: (obj: unknown, strict?: boolean) => obj is ECDSASECP256R1KeyPair =
		checkableGenerator(ECDSASECP256R1KeyPair);

	constructor(_ignored_privateKey: ConstructorParameters<typeof BufferStorage>[0]) {
		/* test helper only */
	}
}

class ED25519KeyPair {
	static isInstance: (obj: unknown, strict?: boolean) => obj is ED25519KeyPair =
		checkableGenerator(ED25519KeyPair);

	constructor(_ignored_privateKey: ConstructorParameters<typeof BufferStorage>[0]) {
		/* test helper only */
	}
}

export const AccountTesting = {
	KeyStorage,
	SeedStorage,
	SignatureStorage,
	ECDSASECP256K1PrivateKey,
	ECDSASECP256K1PublicKey,
	ECDSASECP256R1PrivateKey,
	ECDSASECP256R1PublicKey,
	ED25519PrivateKey,
	ED25519PublicKey,
	ECDSASECP256K1Signature,
	ECDSASECP256R1Signature,
	ED25519Signature,
	PublicKeyString,
	ECDSASECP256K1KeyPair,
	ECDSASECP256R1KeyPair,
	ED25519KeyPair
};

type AccountModule = typeof import('./account');
type AccountModulePublic = Omit<AccountModule, 'AccountTesting'>;

type _AssertMatchesClient = AssertNever<
	| (AccountModulePublic extends typeof import('@keetanetwork/keetanet-client/lib/account') ? never : AccountModulePublic)
	| (typeof import('@keetanetwork/keetanet-client/lib/account') extends AccountModulePublic ? never : typeof import('@keetanetwork/keetanet-client/lib/account'))
>;
