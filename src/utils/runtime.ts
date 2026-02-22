const getWorkers = async (): Promise<typeof import("cloudflare:workers") | undefined> => {
	try {
		return await import("cloudflare:workers");
	} catch {
		return undefined;
	}
};

export default getWorkers;
