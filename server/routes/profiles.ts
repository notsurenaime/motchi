import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { profiles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { normalizeText, parsePositiveInt } from "../lib/validation.js";

export async function profileRoutes(app: FastifyInstance) {
  // List all profiles
  app.get("/api/profiles", async () => {
    return db.select().from(profiles).all();
  });

  // Create profile
  app.post<{ Body: { name: string; avatar?: string; pin?: string } }>(
    "/api/profiles",
    async (req, reply) => {
      const name = normalizeText(req.body?.name, 50);
      const avatar = normalizeText(req.body?.avatar ?? "default", 20) ?? "default";
      const pin = req.body?.pin;
      if (!name) {
        return reply.status(400).send({ error: "Name is required" });
      }
      // Validate PIN format if provided
      if (pin && !/^\d{4}$/.test(pin)) {
        return reply
          .status(400)
          .send({ error: "PIN must be exactly 4 digits" });
      }
      const result = db
        .insert(profiles)
        .values({ name, avatar, pin: pin || null })
        .returning()
        .get();
      return result;
    }
  );

  // Verify PIN
  app.post<{ Params: { id: string }; Body: { pin: string } }>(
    "/api/profiles/:id/verify",
    async (req, reply) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return reply.status(400).send({ error: "Invalid profile id" });
      }
      if (typeof req.body?.pin !== "string") {
        return reply.status(400).send({ error: "PIN is required" });
      }
      const profile = db
        .select()
        .from(profiles)
        .where(eq(profiles.id, id))
        .get();
      if (!profile) {
        return reply.status(404).send({ error: "Profile not found" });
      }
      if (!profile.pin) {
        return { verified: true };
      }
      return { verified: profile.pin === req.body.pin };
    }
  );

  // Delete profile
  app.delete<{ Params: { id: string } }>(
    "/api/profiles/:id",
    async (req, reply) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return reply.status(400).send({ error: "Invalid profile id" });
      }
      if (id === 1) {
        return reply
          .status(400)
          .send({ error: "Cannot delete default profile" });
      }
      const existing = db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, id))
        .get();
      if (!existing) {
        return reply.status(404).send({ error: "Profile not found" });
      }
      db.delete(profiles).where(eq(profiles.id, id)).run();
      return { deleted: true };
    }
  );
}
