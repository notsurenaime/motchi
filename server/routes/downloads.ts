import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { downloads } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";
import { getBestStreamUrl } from "../services/anime-bridge.js";
import {
  isValidEpisodeNumber,
  normalizeText,
  parsePositiveInt,
  sanitizeFileNameSegment,
} from "../lib/validation.js";

const DOWNLOAD_DIR = path.resolve("./downloads");
const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

export async function downloadRoutes(app: FastifyInstance) {
  // Ensure download directory exists
  mkdirSync(DOWNLOAD_DIR, { recursive: true });

  // List all downloads
  app.get("/api/downloads", async () => {
    return db.select().from(downloads).all();
  });

  // Start a download using resolved stream URL
  app.post<{
    Body: {
      animeId: string;
      animeName: string;
      episodeNumber: string;
    };
  }>("/api/downloads", async (req, reply) => {
    const animeId = normalizeText(req.body?.animeId, 80);
    const animeName = normalizeText(req.body?.animeName, 180);
    const episodeNumber = req.body?.episodeNumber;

    if (!animeId || !animeName || !isValidEpisodeNumber(episodeNumber)) {
      return reply.status(400).send({ error: "Invalid download payload" });
    }

    // Check if already downloading/downloaded
    const existing = db
      .select()
      .from(downloads)
      .where(
        and(
          eq(downloads.animeId, animeId),
          eq(downloads.episodeNumber, episodeNumber)
        )
      )
      .get();

    if (existing?.status === "complete" || existing?.status === "downloading") {
      return reply
        .status(409)
        .send({ error: "Already downloaded/downloading" });
    }

    // If there's a previous failed attempt, delete it
    if (existing?.status === "error") {
      db.delete(downloads)
        .where(eq(downloads.id, existing.id))
        .run();
    }

    const fileName = `${sanitizeFileNameSegment(animeName)}_Ep${episodeNumber}.mp4`;
    const filePath = path.join(DOWNLOAD_DIR, fileName);

    const record = db
      .insert(downloads)
      .values({
        animeId,
        animeName,
        episodeNumber,
        filePath: `/downloads/${fileName}`,
        status: "downloading",
      })
      .returning()
      .get();

    // Download in background using resolved stream URL
    (async () => {
      try {
        // Resolve the stream URL
        const streamLink = await getBestStreamUrl(animeId, episodeNumber);
        if (!streamLink) throw new Error("No stream URL found for this episode");

        const headers: Record<string, string> = { "User-Agent": AGENT };
        if (streamLink.referer) headers["Referer"] = streamLink.referer;

        const response = await fetch(streamLink.url, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        if (!response.body) throw new Error("Empty response body");

        const fileStream = createWriteStream(filePath);
        await pipeline(
          Readable.fromWeb(response.body as import("stream/web").ReadableStream),
          fileStream
        );

        const size = existsSync(filePath) ? statSync(filePath).size : null;
        db.update(downloads)
          .set({ status: "complete", fileSize: size })
          .where(eq(downloads.id, record.id))
          .run();
      } catch (err: any) {
        const errorMsg = err?.message ?? String(err);
        console.error(`Download failed for ${animeName} Ep${episodeNumber}:`, errorMsg);
        db.update(downloads)
          .set({ status: "error", errorMessage: errorMsg })
          .where(eq(downloads.id, record.id))
          .run();
        // Clean up partial file
        try { if (existsSync(filePath)) unlinkSync(filePath); } catch {}
      }
    })();

    return record;
  });

  // Delete a download
  app.delete<{ Params: { id: string } }>(
    "/api/downloads/:id",
    async (req, reply) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return reply.status(400).send({ error: "Invalid download id" });
      }
      const record = db
        .select()
        .from(downloads)
        .where(eq(downloads.id, id))
        .get();
      if (!record) {
        return reply.status(404).send({ error: "Not found" });
      }
      // Clean up file on disk
      try {
        const diskPath = path.join(DOWNLOAD_DIR, path.basename(record.filePath));
        if (existsSync(diskPath)) unlinkSync(diskPath);
      } catch {}
      db.delete(downloads).where(eq(downloads.id, id)).run();
      return { deleted: true };
    }
  );
}
