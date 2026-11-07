import { fileURLToPath } from "node:url";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export default async function docsRoutes(app) {
  await app.register(swagger, {
    mode: "static",
    specification: {
      path: fileURLToPath(
        new URL("../../api-docs/swagger.json", import.meta.url),
      ),
    },
  });

  await app.register(swaggerUi, { routePrefix: "/api-docs", staticCSP: true });
  app.get("/api-docs/swagger.json", async () => app.swagger());
}
