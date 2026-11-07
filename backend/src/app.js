import { existsSync } from "node:fs";
import cors from "@fastify/cors";
import Fastify from "fastify";
import docsRoutes from "./routes/docs.routes.js";
import healthRoutes from "./routes/health.routes.js";
import prPreviewRoutes from "./routes/pr-preview.routes.js";
import { createDatabasePool } from "./services/database.service.js";

if (existsSync(".env")) process.loadEnvFile();

const app = Fastify({ logger: true });
const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

try {
  const db = createDatabasePool();
  app.decorate("db", db);
  app.addHook("onClose", async () => db.end());

  await app.register(cors, { origin: allowedOrigins, preflight: false });
  await app.register(healthRoutes, { allowedOrigins });
  await app.register(docsRoutes);
  await app.register(prPreviewRoutes);
  await app.listen({ port: 3001, host: "0.0.0.0" });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      try {
        await app.close();
      } catch (error) {
        app.log.error(error, "Failed to shut down");
        process.exitCode = 1;
      }
    });
  }
} catch (error) {
  app.log.error(error, "Failed to start");
  await app.close();
  process.exitCode = 1;
}
