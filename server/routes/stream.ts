import { FastifyInstance } from "fastify";
import { getSkipTimes, findMalId } from "../services/aniskip.js";
import { normalizeText } from "../lib/validation.js";

export async function streamRoutes(app: FastifyInstance) {
  // Get skip times for an episode
  app.get<{
    Querystring: {
      title: string;
      episode: string;
      duration?: string;
    };
  }>("/api/skip-times", async (req, reply) => {
    const title = normalizeText(req.query.title, 200);
    if (!title) return reply.status(400).send({ error: "title is required" });

    const epNum = parseInt(req.query.episode, 10);
    if (!Number.isFinite(epNum) || epNum <= 0) return reply.status(400).send({ error: "Invalid episode number" });

    const dur = req.query.duration ? parseFloat(req.query.duration) : undefined;
    if (dur !== undefined && (!Number.isFinite(dur) || dur <= 0)) return reply.status(400).send({ error: "Invalid duration" });

    const malId = await findMalId(title);
    if (!malId) return { skipTimes: [], malId: null };

    const skipTimes = await getSkipTimes(malId, epNum, dur);
    return { skipTimes, malId };
  });
}
