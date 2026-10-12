const START = 0;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- typed arrays have no readonly variant
const concatBytes = (chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> => {
	let total = START;
	for (const chunk of chunks) {
		total += chunk.length;
	}

	const all = new Uint8Array(total);
	let offset = START;
	for (const chunk of chunks) {
		all.set(chunk, offset);
		offset += chunk.length;
	}
	return all;
};

export default concatBytes;
