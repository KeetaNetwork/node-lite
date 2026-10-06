import { checkableGenerator } from './helper';
import type { AssertNever } from './never';
import type { PublicConstructable } from './static-types';

/**
 * Class to store a BitField.
 * Simple array of 0/1 values.
 */
class BitField {
	#bits: boolean[] = [];

	static isInstance: (obj: unknown, strict?: boolean) => obj is BitField = checkableGenerator(BitField);

	constructor(data?: BitField | bigint | number[]) {
		if (data === undefined) {
			return;
		}
		if (BitField.isInstance(data)) {
			this.#bits = data.#bits.slice();
			return;
		}
		if (typeof data === 'bigint') {
			let value = data;
			let offset = 0;
			while (value > 0n) {
				if ((value & 1n) === 1n) {
					this.set(offset, true);
				}
				value >>= 1n;
				offset++;
			}
			return;
		}
		if (Array.isArray(data)) {
			for (const offset of data) {
				this.set(offset, true);
			}
		}
	}

	set(offset: number | bigint, value: boolean | 0 | 1): void {
		const index = Number(offset);
		if (index < 0 || !Number.isInteger(index)) {
			throw(new Error(`Invalid bitfield offset: ${String(offset)}`));
		}
		if (value !== true && value !== false && value !== 0 && value !== 1) {
			throw(new Error('Bitfield value must be a boolean or 0, 1'));
		}
		while (this.#bits.length <= index) {
			this.#bits.push(false);
		}
		this.#bits[index] = value === true || value === 1;
	}

	get size(): number {
		return(this.#bits.length);
	}

	get(offset: number | bigint): boolean {
		const index = Number(offset);
		if (index < 0 || index >= this.#bits.length) {
			return(false);
		}
		return(this.#bits[index]);
	}

	get bigint(): bigint {
		let value = 0n;
		for (let i = 0; i < this.#bits.length; i++) {
			if (this.#bits[i]) {
				value |= 1n << BigInt(i);
			}
		}
		return(value);
	}
}

type ClientBitField = typeof import('@keetanetwork/keetanet-client/lib/utils/bitfield');
export default BitField;

type _AssertMatchesClient = AssertNever<
	| (PublicConstructable<typeof BitField> extends PublicConstructable<ClientBitField['default']> ? never : PublicConstructable<typeof BitField>)
	| (PublicConstructable<ClientBitField['default']> extends PublicConstructable<typeof BitField> ? never : PublicConstructable<ClientBitField['default']>)
>;
