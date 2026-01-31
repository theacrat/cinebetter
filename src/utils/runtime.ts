export async function getWorkers() {
	try {
		const workers = await import('cloudflare:workers');
		return workers;
	}
	catch {
		return undefined;
	}
}
