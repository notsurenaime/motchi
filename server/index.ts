import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
import { spawn, type ChildProcess } from "child_process";

// Initialize database (runs migrations)
import "./db/migrate.js";

import { animeRoutes } from "./routes/anime.js";
import { profileRoutes } from "./routes/profiles.js";
import { historyRoutes } from "./routes/history.js";
import { downloadRoutes } from "./routes/downloads.js";
import { streamRoutes } from "./routes/stream.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { prefetchPopularAnime } from "./services/prefetch.js";
import { warmAnimeCatalogTotal } from "./services/anime-bridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProduction = NODE_ENV === "production";
const configuredCorsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedCorsOrigins = new Set(
  configuredCorsOrigins.length > 0
    ? configuredCorsOrigins
    : isProduction
      ? []
      : defaultDevOrigins
);

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
await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedCorsOrigins.has(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Detect if built frontend is available
// __dirname in dev (tsx): <root>/server, in prod (compiled): <root>/dist/server
const clientDirCandidates = [
  path.resolve(__dirname, "../client"),         // compiled: dist/server -> dist/client
  path.resolve(__dirname, "../dist/client"),     // dev (tsx): server -> dist/client
];
const resolvedClientDir = clientDirCandidates.find((d) => existsSync(d)) ?? null;

// Serve downloaded files (first registration decorates reply)
await app.register(fastifyStatic, {
  root: path.resolve("./downloads"),
  prefix: "/downloads/",
});

// If we have a built frontend, add it as an additional root
if (resolvedClientDir) {
  app.log.info(`Serving frontend from ${resolvedClientDir}`);
  await app.register(fastifyStatic, {
    root: resolvedClientDir,
    prefix: "/",
    decorateReply: false,
  });
}

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

// SPA fallback or 404
if (resolvedClientDir) {
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
    if (tunnelProcess) {
      tunnelProcess.kill();
      tunnelProcess = null;
    }
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Failed to shut down cleanly");
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

let tunnelProcess: ChildProcess | null = null;

function startTunnel() {
  try {
    // Use named tunnel if config exists, otherwise fall back to quick tunnel
    const hasConfig = existsSync(path.join(process.env.HOME ?? "~", ".cloudflared/config.yml"));
    const args = hasConfig
      ? ["tunnel", "run"]
      : ["tunnel", "--url", `http://localhost:${PORT}`];

    const cf = spawn("cloudflared", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    cf.stderr?.on("data", (data: Buffer) => {
      const line = data.toString();
      // Quick tunnel URL
      const urlMatch = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (urlMatch) {
        app.log.info(`Tunnel URL: ${urlMatch[0]}`);
      }
      // Named tunnel connected
      if (line.includes("Registered tunnel connection")) {
        const domain = process.env.TUNNEL_DOMAIN;
        app.log.info(domain ? `Tunnel connected: https://${domain}` : "Tunnel connected");
      }
    });

    cf.on("error", (err) => {
      app.log.warn(`Cloudflare tunnel not available: ${err.message}`);
    });

    cf.on("exit", (code) => {
      if (code !== null && code !== 0) {
        app.log.warn(`Cloudflare tunnel exited with code ${code}`);
      }
      tunnelProcess = null;
    });

    tunnelProcess = cf;
  } catch {
    app.log.warn("cloudflared not installed — skipping tunnel");
  }
}

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Motchi server running on http://localhost:${PORT}`);

  // Start Cloudflare tunnel for remote access only when explicitly enabled.
  if (process.env.ENABLE_TUNNEL === "1") {
    startTunnel();
  }

  // Start pre-fetching in background (don't block startup)
  void prefetchPopularAnime().catch((error) => {
    app.log.error(error, "Background prefetch error");
  });

  warmAnimeCatalogTotal("sub");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
