const START = 0;

const encoder = new TextEncoder();
const latin1Decoder = new TextDecoder("latin1");

type Socket = ReturnType<(typeof import("cloudflare:sockets"))["connect"]>;

interface Connection {
	readonly readExactly: (length: number) => Promise<Uint8Array>;
	readonly readToEnd: () => Promise<string>;
	readonly release: () => void;
	readonly write: (bytes: readonly number[] | string) => Promise<void>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Socket's streams are inherently mutable
const openConnection = (socket: Socket): Connection => {
	// oxlint-disable-next-line typescript/no-unsafe-assignment -- workers-types declares socket streams as any, but they always carry bytes
	const reader: ReadableStreamDefaultReader<Uint8Array> = socket.readable.getReader();
	// oxlint-disable-next-line typescript/no-unsafe-assignment -- workers-types declares socket streams as any, but they always carry bytes
	const writer: WritableStreamDefaultWriter<Uint8Array> = socket.writable.getWriter();
	let pending: Uint8Array = new Uint8Array();

	const readExactly = async (length: number): Promise<Uint8Array> => {
		if (pending.length >= length) {
			const out = pending.slice(START, length);
			pending = pending.slice(length);
			return out;
		}
		const { done, value } = await reader.read();
		if (done) {
			throw new Error("SOCKS connection closed early");
		}
		const merged = new Uint8Array(pending.length + value.length);
		merged.set(pending);
		merged.set(value, pending.length);
		pending = merged;
		return readExactly(length);
	};

	const readRemaining = async (chunks: readonly string[]): Promise<string> => {
		const { done, value } = await reader.read();
		return done
			? chunks.join("")
			: readRemaining([...chunks, latin1Decoder.decode(value, { stream: true })]);
	};

	const readToEnd = async (): Promise<string> => {
		const buffered = latin1Decoder.decode(pending, { stream: true });
		pending = new Uint8Array();
		return readRemaining([buffered]);
	};

	return {
		readExactly,
		readToEnd,
		release: (): void => {
			reader.releaseLock();
			writer.releaseLock();
		},
		write: async (bytes: readonly number[] | string): Promise<void> =>
			writer.write(typeof bytes === "string" ? encoder.encode(bytes) : Uint8Array.from(bytes)),
	};
};

export { openConnection, type Connection, type Socket };
