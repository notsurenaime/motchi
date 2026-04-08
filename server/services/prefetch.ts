/**
 * Prefetch Service
 * On server start, populates the SQLite cache with metadata for popular anime.
 * Prevents calling AllAnime API on every page load.
 */

import { db } from "../db/index.js";
import { animeCache } from "../db/schema.js";
import { searchAnime, getAnimeDetail, extractBaseName } from "./anime-bridge.js";
import { isRelatedToQuery } from "./anime-names.js";
import { eq } from "drizzle-orm";

const POPULAR_QUERIES = [
  "Jujutsu Kaisen",
  "Demon Slayer",
  "Kimetsu no Yaiba",
  "One Piece",
  "Attack on Titan",
  "Shingeki no Kyojin",
  "My Hero Academia",
  "Boku no Hero Academia",
  "Chainsaw Man",
  "Spy x Family",
  "Naruto",
  "Naruto Shippuuden",
  "Nato",
  "Boruto",
  "Bleach",
  "Burichi",
  "Dragon Ball",
  "Dragon Ball Daima",
  "Solo Leveling",
  "Ore dake Level Up na Ken",
  "Frieren",
  "Sousou no Frieren",
  "Oshi no Ko",
  "Dandadan",
  "Blue Lock",
  "Angels of Death",
  "Death Note",
  "Fullmetal Alchemist",
  "Hunter x Hunter",
  "Sword Art Online",
  "Tokyo Ghoul",
  "One Punch Man",
  "Mob Psycho 100",
  "Vinland Saga",
  "Mushoku Tensei",
  "Re:Zero",
  "Konosuba",
  "Overlord",
  "That Time I Got Reincarnated as a Slime",
  "Tensei Shitara Slime Datta Ken",
  "The Rising of the Shield Hero",
  "Tate no Yuusha no Nariagari",
  "Dr. Stone",
  "Fire Force",
  "Enen no Shouboutai",
  "Black Clover",
  "Fairy Tail",
  "Haikyuu",
  "Kuroko no Basket",
  "Assassination Classroom",
  "Ansatsu Kyoushitsu",
  "Steins Gate",
  "Code Geass",
  "Neon Genesis Evangelion",
  "Cowboy Bebop",
  "Samurai Champloo",
  "Violet Evergarden",
  "Your Lie in April",
  "Toradora",
  "Clannad",
  "Rent a Girlfriend",
  "Kanojo Okarishimasu",
  "Kaguya-sama Love is War",
  "Horimiya",
  "Bocchi the Rock",
  "Lycoris Recoil",
  "Cyberpunk Edgerunners",
  "Hell's Paradise",
  "Undead Unluck",
  "Kaiju No. 8",
  "Kaijuu 8-gou",
  "Wind Breaker",
  "Classroom of the Elite",
  "The Apothecary Diaries",
  "Kusuriya no Hitorigoto",
  "Delicious in Dungeon",
  "Dungeon Meshi",
  "Shangri-La Frontier",
  "Fate Stay Night",
  "Psycho-Pass",
  "Made in Abyss",
  "Parasyte",
  "Erased",
  "Promised Neverland",
  "Dororo",
  "Berserk",
  "Trigun",
  "Inuyasha",
  "Rurouni Kenshin",
  "Serial Experiments Lain",
  "Ghost in the Shell",
  "Odd Taxi",
];

export async function prefetchPopularAnime() {
  console.log("[prefetch] Starting metadata pre-fetch for popular anime...");

  let totalCached = 0;
  for (const query of POPULAR_QUERIES) {
    try {
      const results = await searchAnime(query);
      const topResults = results
        .filter((r) => isRelatedToQuery(query, r.name, extractBaseName))
        .slice(0, 10);

      for (const anime of topResults) {
        try {
          // Check if already cached (less than 24h old)
          const existing = db
            .select()
            .from(animeCache)
            .where(eq(animeCache.id, anime.id))
            .get();

          if (existing) {
            const age =
              Date.now() - (existing.cachedAt as unknown as Date).getTime();
            if (age < 24 * 60 * 60 * 1000) continue;
          }

          const detail = await getAnimeDetail(anime.id);

          await db
            .insert(animeCache)
            .values({
              id: anime.id,
              name: detail.name,
              imageUrl: detail.thumbnail,
              bannerUrl: detail.banner,
              description: detail.description,
              genres: JSON.stringify(detail.genres),
              status: detail.status,
              episodeCount: detail.episodeCount,
              rating: detail.rating,
            })
            .onConflictDoUpdate({
              target: animeCache.id,
              set: {
                name: detail.name,
                imageUrl: detail.thumbnail,
                bannerUrl: detail.banner,
                description: detail.description,
                genres: JSON.stringify(detail.genres),
                status: detail.status,
                episodeCount: detail.episodeCount,
                rating: detail.rating,
                cachedAt: new Date(),
              },
            });

          totalCached++;
        } catch (err) {
          // silently skip individual failures
        }
      }

      // Rate limit — don't hammer the API
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      // silently skip query failures
    }
  }

  console.log(`[prefetch] Pre-fetch complete. Cached ${totalCached} new entries.`);
}
