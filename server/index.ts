import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";

// Initialize database (runs migrations)
import "./db/migrate.js";

import { animeRoutes } from "./routes/anime.js";
import { profileRoutes } from "./routes/profiles.js";
import { historyRoutes } from "./routes/history.js";
import { downloadRoutes } from "./routes/downloads.js";
import { streamRoutes } from "./routes/stream.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { prefetchPopularAnime } from "./services/prefetch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
  },
});

app.setErrorHandler(async (error, request, reply) => {
  const fastifyError =
    typeof error === "object" && error !== null ? error : new Error(String(error));
  const statusCode =
    "statusCode" in fastifyError &&
    typeof fastifyError.statusCode === "number" &&
    fastifyError.statusCode >= 400 &&
    fastifyError.statusCode < 600
      ? fastifyError.statusCode
      : 500;

  request.log.error(
    {
      err: fastifyError,
      method: request.method,
      url: request.url,
    },
    "Request failed"
  );

  if (reply.sent) {
    return;
  }

  reply.status(statusCode).send({
    error:
      statusCode >= 500
        ? "Internal server error"
        : fastifyError instanceof Error
          ? fastifyError.message
          : "Request failed",
  });
});

// CORS for dev
await app.register(cors, { origin: true });

// Serve downloaded files
await app.register(fastifyStatic, {
  root: path.resolve("./downloads"),
  prefix: "/downloads/",
  decorateReply: false,
});

// Register routes
await app.register(animeRoutes);
await app.register(profileRoutes);
await app.register(historyRoutes);
await app.register(downloadRoutes);
await app.register(streamRoutes);
await app.register(watchlistRoutes);

// Health check
app.get("/api/health", async () => ({
  status: "ok",
  version: "1.0.0",
  name: "Motchi",
}));

// In production, serve the built frontend
// __dirname in dev: <root>/server, in prod: <root>/dist/server
const clientDir = path.resolve(__dirname, "../client");
const clientDirAlt = path.resolve(__dirname, "../../dist/client");
const resolvedClientDir = existsSync(clientDir) ? clientDir : existsSync(clientDirAlt) ? clientDirAlt : null;

if (resolvedClientDir) {
  await app.register(fastifyStatic, {
    root: resolvedClientDir,
    prefix: "/",
    decorateReply: false,
  });

  // SPA fallback: serve index.html for all non-API, non-file routes
  const indexHtml = readFileSync(path.join(resolvedClientDir, "index.html"), "utf-8");
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/") || request.url.startsWith("/downloads/")) {
      return reply.status(404).send({ error: "Route not found" });
    }
    reply.type("text/html").send(indexHtml);
  });
} else {
  app.setNotFoundHandler(async (_request, reply) => {
    reply.status(404).send({ error: "Route not found" });
  });
}

// Start server
const PORT = parseInt(process.env.PORT ?? "3001");

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down server");
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Failed to shut down cleanly");
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Motchi server running on http://localhost:${PORT}`);

  // Start pre-fetching in background (don't block startup)
  void prefetchPopularAnime().catch((error) => {
    app.log.error(error, "Background prefetch error");
  });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
