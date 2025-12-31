import { getRuntimeKey, Runtime } from "hono/adapter";

const persistent: Runtime[] = ["bun", "node"];

export function isServerless() {
	return !persistent.includes(getRuntimeKey());
}
