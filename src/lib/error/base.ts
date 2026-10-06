import { checkableGenerator } from '../utils/helper';
import type { AssertNever } from '../utils/never';

interface ValidationOptions {
	type: string;
	codes: string[] | readonly string[];
}

export class KeetaNetErrorBase<CodeType extends string> extends Error {
	static readonly isInstance: (obj: unknown, strict?: boolean) => obj is KeetaNetErrorBase<string> =
		checkableGenerator(KeetaNetErrorBase);

	type: string;
	code: CodeType;

	constructor(code: CodeType, message: string, validation?: ValidationOptions) {
		super(message);
		this.name = new.target.name;
		this.code = code;
		this.type = validation?.type ?? 'UNKNOWN';
		if (validation !== undefined && !validation.codes.includes(code)) {
			throw(new Error(`Invalid error code ${code} for type ${validation.type}`));
		}
	}

	toJSON(): { type: string; code: CodeType; message: string } {
		return({
			type: this.type,
			code: this.code,
			message: this.message
		});
	}
}

type _AssertMatchesClient = AssertNever<
	| (typeof import('./base') extends typeof import('@keetanetwork/keetanet-client/lib/error/base') ? never : typeof import('./base'))
	| (typeof import('@keetanetwork/keetanet-client/lib/error/base') extends typeof import('./base') ? never : typeof import('@keetanetwork/keetanet-client/lib/error/base'))
>;
