import { FastifyInstance } from "fastify";
import { getSkipTimes, findMalId } from "../services/aniskip.js";

export async function streamRoutes(app: FastifyInstance) {
  // Get skip times for an episode
  app.get<{
    Querystring: {
      title: string;
      episode: string;
      duration?: string;
    };
  }>("/api/skip-times", async (req) => {
    const { title, episode, duration } = req.query;
    const malId = await findMalId(title);
    if (!malId) return { skipTimes: [], malId: null };

    const epNum = parseInt(episode);
    const dur = duration ? parseFloat(duration) : undefined;
    const skipTimes = await getSkipTimes(malId, epNum, dur);
    return { skipTimes, malId };
  });
}
