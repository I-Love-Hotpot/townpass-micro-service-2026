import { existsSync } from "node:fs";
import Fastify from "fastify";
import prPreviewRoutes from "./routes/pr-preview.routes.js";

if (existsSync(".env")) process.loadEnvFile();

const app = Fastify({ logger: true });
await app.register(prPreviewRoutes);
app.get("/health", async () => ({ status: "ok" }));

try {
  await app.listen({ port: 3001, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error, "Failed to start PR menu API");
  process.exitCode = 1;
}
