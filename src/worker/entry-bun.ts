import app from "./app";
import { serveStatic } from "hono/bun";

app.use("/assets/*", serveStatic({ root: "./dist/client" }));

app.get("*", serveStatic({ path: "./dist/client/index.html" }));

const port = Number(process.env.PORT) || 3000;

export default {
	port,
	fetch: app.fetch,
};
