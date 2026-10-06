import type { AssertNever } from '../utils/never';
import type { PublicConstructable } from '../utils/static-types';
import type { Logger } from '../log';
import Log from '../log';

interface DisposableTimingHandle extends Disposable {
	id: symbol;
	end: () => void;
	[Symbol.dispose]: () => void;
}

type TimingEntry = {
	name: string;
	startedAt: number;
	duration?: number;
};

class RequestTiming {
	static defaultLogger: Logger | '@legacy' = '@legacy';

	log: Logger;
	#active = new Map<symbol, TimingEntry>();
	#completed: { [section: string]: { name: string; duration: number }} = {};
	#counter = 0;

	constructor() {
		this.log = RequestTiming.defaultLogger === '@legacy'
			? Log.Legacy()
			: RequestTiming.defaultLogger;
	}

	startTime(section: string): DisposableTimingHandle {
		const id = Symbol(section);
		this.#active.set(id, { name: section, startedAt: performance.now() });
		const end = () => {
			this.endTime(id);
		};
		return({
			id,
			end,
			[Symbol.dispose]: end
		});
	}

	endTime(section: symbol | undefined | ReturnType<RequestTiming['startTime']>): void;
	/** @deprecated */
	endTime(section: string | undefined, deduplicate?: boolean): void;
	endTime(
		section: symbol | string | undefined | ReturnType<RequestTiming['startTime']>,
		_ignored_deduplicate?: boolean
	): void {
		let id: symbol | undefined;
		if (typeof section === 'string') {
			for (const [key, entry] of this.#active) {
				if (entry.name === section) {
					id = key;
					break;
				}
			}
		} else if (typeof section === 'symbol') {
			id = section;
		} else if (section !== undefined) {
			id = section.id;
		}
		if (id === undefined) {
			return;
		}
		const entry = this.#active.get(id);
		if (entry === undefined) {
			return;
		}
		this.#active.delete(id);
		const duration = performance.now() - entry.startedAt;
		this.#completed[entry.name] = { name: entry.name, duration };
	}

	static async runTimer<T>(
		section: string,
		timing: RequestTiming | undefined,
		code: () => Promise<T>
	): Promise<T> {
		if (timing === undefined) {
			return(await code());
		}
		return(await timing.runTimer(section, code));
	}

	async runTimer<T>(section: string, code: () => Promise<T>): Promise<T> {
		const handle = this.startTime(section);
		try {
			return(await code());
		} finally {
			handle.end();
		}
	}

	getAllTiming(): { [section: string]: { name: string; duration: number }} {
		return({ ...this.#completed });
	}

	counter(): number {
		return(++this.#counter);
	}
}

type ClientTiming = typeof import('@keetanetwork/keetanet-client/lib/node/timing');
export { RequestTiming };
export default RequestTiming;

type _AssertMatchesClient = AssertNever<
	| (PublicConstructable<typeof RequestTiming> extends PublicConstructable<ClientTiming['RequestTiming']> ? never : PublicConstructable<typeof RequestTiming>)
	| (PublicConstructable<ClientTiming['RequestTiming']> extends PublicConstructable<typeof RequestTiming> ? never : PublicConstructable<ClientTiming['RequestTiming']>)
>;
