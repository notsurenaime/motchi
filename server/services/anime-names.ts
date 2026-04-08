/**
 * Anime Series Mapping
 *
 * Maps Japanese/romaji AllAnime names to proper English display names,
 * and defines which entries belong to the same series for grouping.
 *
 * Each entry maps a "base name key" (lowercase) to:
 *   - displayName: the canonical English title for the series
 *   - patterns: additional patterns to match against extracted base names
 */

interface SeriesMapping {
  displayName: string;
  /** Extra base-name patterns (lowercase) that should merge into this series */
  aliases: string[];
}

// Map from canonical lowercase key -> series info
const SERIES_MAP: Record<string, SeriesMapping> = {
  "jujutsu kaisen": {
    displayName: "Jujutsu Kaisen",
    aliases: [],
  },
  "kimetsu no yaiba": {
    displayName: "Demon Slayer",
    aliases: [],
  },
  "1p": {
    displayName: "One Piece",
    aliases: ["one piece"],
  },
  "one piece": {
    displayName: "One Piece",
    aliases: ["1p"],
  },
  "shingeki no kyojin": {
    displayName: "Attack on Titan",
    aliases: [],
  },
  "boku no hero academia": {
    displayName: "My Hero Academia",
    aliases: [],
  },
  "vigilante": {
    displayName: "My Hero Academia: Vigilantes",
    aliases: [],
  },
  "chainsaw man": {
    displayName: "Chainsaw Man",
    aliases: [],
  },
  "spy x family": {
    displayName: "Spy x Family",
    aliases: [],
  },
  "naruto": {
    displayName: "Naruto",
    aliases: ["nato"],
  },
  "nato": {
    displayName: "Naruto",
    aliases: ["naruto"],
  },
  "naruto shippuden": {
    displayName: "Naruto: Shippuden",
    aliases: ["naruto shippuuden", "nato shippuuden"],
  },
  "naruto shippuuden": {
    displayName: "Naruto: Shippuden",
    aliases: ["naruto shippuden", "nato shippuuden"],
  },
  "nato shippuuden": {
    displayName: "Naruto: Shippuden",
    aliases: ["naruto shippuden", "naruto shippuuden"],
  },
  "naruto extras": {
    displayName: "Naruto Extras",
    aliases: ["road of naruto", "naruto sd"],
  },
  "road of naruto": {
    displayName: "Naruto Extras",
    aliases: ["naruto extras", "naruto sd"],
  },
  "naruto sd": {
    displayName: "Naruto Extras",
    aliases: ["naruto extras", "road of naruto"],
  },
  "boruto": {
    displayName: "Boruto: Naruto Next Generations",
    aliases: [],
  },
  "bleach": {
    displayName: "Bleach",
    aliases: ["bleach karaburi!", "burichi"],
  },
  "bleach karaburi!": {
    displayName: "Bleach",
    aliases: ["bleach", "burichi"],
  },
  "burichi": {
    displayName: "Bleach",
    aliases: ["bleach", "bleach karaburi!"],
  },
  "dragon ball daima": {
    displayName: "Dragon Ball Daima",
    aliases: [],
  },
  "dragon ball": {
    displayName: "Dragon Ball",
    aliases: ["super dragon ball heroes meteor mission"],
  },
  "super dragon ball heroes meteor mission": {
    displayName: "Dragon Ball",
    aliases: ["dragon ball"],
  },
  "ore dake level up na ken": {
    displayName: "Solo Leveling",
    aliases: [],
  },
  "sousou no frieren": {
    displayName: "Frieren: Beyond Journey's End",
    aliases: ["frieren"],
  },
  "frieren": {
    displayName: "Frieren: Beyond Journey's End",
    aliases: ["sousou no frieren"],
  },
  "[oshi no ko]": {
    displayName: "Oshi no Ko",
    aliases: [],
  },
  "dandadan": {
    displayName: "Dandadan",
    aliases: [],
  },
  "blue lock": {
    displayName: "Blue Lock",
    aliases: [],
  },
  "satsuriku no tenshi": {
    displayName: "Angels of Death",
    aliases: [],
  },
  "death note": {
    displayName: "Death Note",
    aliases: [],
  },
  "fullmetal alchemist": {
    displayName: "Fullmetal Alchemist: Brotherhood",
    aliases: [],
  },
  "hunter x hunter": {
    displayName: "Hunter x Hunter",
    aliases: ["huan you lieren"],
  },
  "huan you lieren": {
    displayName: "Hunter x Hunter",
    aliases: ["hunter x hunter"],
  },
  "sword art online": {
    displayName: "Sword Art Online",
    aliases: [],
  },
  "tokyo ghoul": {
    displayName: "Tokyo Ghoul",
    aliases: ["tokyo ghoul:re", "tokyo ghoul √a"],
  },
  "tokyo ghoul:re": {
    displayName: "Tokyo Ghoul",
    aliases: ["tokyo ghoul", "tokyo ghoul √a"],
  },
  "tokyo ghoul √a": {
    displayName: "Tokyo Ghoul",
    aliases: ["tokyo ghoul", "tokyo ghoul:re"],
  },
  "one punch man": {
    displayName: "One Punch Man",
    aliases: [],
  },
  "mob psycho": {
    displayName: "Mob Psycho 100",
    aliases: ["mob psycho 100", "mob psycho mini"],
  },
  "mob psycho 100": {
    displayName: "Mob Psycho 100",
    aliases: ["mob psycho", "mob psycho mini"],
  },
  "mob psycho mini": {
    displayName: "Mob Psycho 100",
    aliases: ["mob psycho", "mob psycho 100"],
  },
  "vinland saga": {
    displayName: "Vinland Saga",
    aliases: [],
  },
  "mushoku tensei": {
    displayName: "Mushoku Tensei: Jobless Reincarnation",
    aliases: ["mushoku tensei ii"],
  },
  "mushoku tensei ii": {
    displayName: "Mushoku Tensei: Jobless Reincarnation",
    aliases: ["mushoku tensei"],
  },
  "re:zero kara hajimeru isekai seikatsu": {
    displayName: "Re:Zero",
    aliases: ["re:zero kara hajimeru break time", "re:zero kara hajimeru kyuukei jikan (break time)"],
  },
  "re:zero kara hajimeru break time": {
    displayName: "Re:Zero",
    aliases: ["re:zero kara hajimeru isekai seikatsu"],
  },
  "re:zero kara hajimeru kyuukei jikan (break time)": {
    displayName: "Re:Zero",
    aliases: ["re:zero kara hajimeru isekai seikatsu"],
  },
  "kono subarashii sekai ni shukufuku wo!": {
    displayName: "KonoSuba",
    aliases: ["kono subarashii sekai ni bakuen wo!"],
  },
  "kono subarashii sekai ni bakuen wo!": {
    displayName: "KonoSuba",
    aliases: ["kono subarashii sekai ni shukufuku wo!"],
  },
  "overlord": {
    displayName: "Overlord",
    aliases: ["overlord iv"],
  },
  "overlord iv": {
    displayName: "Overlord",
    aliases: ["overlord"],
  },
  "i am the monster overlord": {
    displayName: "I Am the Monster Overlord",
    aliases: ["the monster overlord"],
  },
  "the monster overlord": {
    displayName: "I Am the Monster Overlord",
    aliases: ["i am the monster overlord"],
  },
  "tensei shitara slime datta ken": {
    displayName: "That Time I Got Reincarnated as a Slime",
    aliases: ["tensei shitara slime datta ken", "sukuwareru ramiris"],
  },
  "sukuwareru ramiris": {
    displayName: "That Time I Got Reincarnated as a Slime",
    aliases: ["tensei shitara slime datta ken"],
  },
  "tate no yuusha no nariagari": {
    displayName: "The Rising of the Shield Hero",
    aliases: [],
  },
  "dr. stone": {
    displayName: "Dr. Stone",
    aliases: [],
  },
  "enen no shouboutai": {
    displayName: "Fire Force",
    aliases: ["enen no shouboutai mini anime"],
  },
  "enen no shouboutai mini anime": {
    displayName: "Fire Force",
    aliases: ["enen no shouboutai"],
  },
  "b.c.": {
    displayName: "Black Clover",
    aliases: ["black clover", "mugyutto! black clover"],
  },
  "black clover": {
    displayName: "Black Clover",
    aliases: ["b.c.", "mugyutto! black clover"],
  },
  "mugyutto! black clover": {
    displayName: "Black Clover",
    aliases: ["b.c.", "black clover"],
  },
  "fairy tail": {
    displayName: "Fairy Tail",
    aliases: ["fairy tail x rave"],
  },
  "fairy tail x rave": {
    displayName: "Fairy Tail",
    aliases: ["fairy tail"],
  },
  "haikyuu!!": {
    displayName: "Haikyu!!",
    aliases: ["haikyuu!! to the top", "haikyuu!! quest"],
  },
  "haikyuu!! to the top": {
    displayName: "Haikyu!!",
    aliases: ["haikyuu!!", "haikyuu!! quest"],
  },
  "haikyuu!! quest": {
    displayName: "Haikyu!!",
    aliases: ["haikyuu!!", "haikyuu!! to the top"],
  },
  "kuroko no basket": {
    displayName: "Kuroko's Basketball",
    aliases: [],
  },
  "ansatsu kyoushitsu": {
    displayName: "Assassination Classroom",
    aliases: [],
  },
  "steins;gate": {
    displayName: "Steins;Gate",
    aliases: [],
  },
  "code geass": {
    displayName: "Code Geass",
    aliases: [],
  },
  "shinseiki evangelion": {
    displayName: "Neon Genesis Evangelion",
    aliases: ["petit eva", "evangelion"],
  },
  "petit eva": {
    displayName: "Neon Genesis Evangelion",
    aliases: ["shinseiki evangelion", "evangelion"],
  },
  "evangelion": {
    displayName: "Neon Genesis Evangelion",
    aliases: ["shinseiki evangelion", "petit eva"],
  },
  "cowboy bebop": {
    displayName: "Cowboy Bebop",
    aliases: [],
  },
  "samurai champloo": {
    displayName: "Samurai Champloo",
    aliases: [],
  },
  "violet evergarden": {
    displayName: "Violet Evergarden",
    aliases: [],
  },
  "shigatsu wa kimi no uso": {
    displayName: "Your Lie in April",
    aliases: [],
  },
  "toradora!": {
    displayName: "Toradora!",
    aliases: [],
  },
  "clannad": {
    displayName: "Clannad",
    aliases: [],
  },
  "kanojo, okarishimasu": {
    displayName: "Rent-a-Girlfriend",
    aliases: ["kanojo, okarishimasu petit"],
  },
  "kanojo, okarishimasu petit": {
    displayName: "Rent-a-Girlfriend",
    aliases: ["kanojo, okarishimasu"],
  },
  "kaguya-sama wa kokurasetai": {
    displayName: "Kaguya-sama: Love Is War",
    aliases: ["kaguya-sama wa kokurasetai? tensai-tachi no renai zunousen"],
  },
  "kaguya-sama wa kokurasetai? tensai-tachi no renai zunousen": {
    displayName: "Kaguya-sama: Love Is War",
    aliases: ["kaguya-sama wa kokurasetai"],
  },
  "horimiya": {
    displayName: "Horimiya",
    aliases: ["hori-san to miyamura-kun"],
  },
  "hori-san to miyamura-kun": {
    displayName: "Horimiya",
    aliases: ["horimiya"],
  },
  "bocchi the rock!": {
    displayName: "Bocchi the Rock!",
    aliases: ["bocchi the rock! re:re:"],
  },
  "bocchi the rock! re:re:": {
    displayName: "Bocchi the Rock!",
    aliases: ["bocchi the rock!"],
  },
  "lycoris recoil": {
    displayName: "Lycoris Recoil",
    aliases: [],
  },
  "cyberpunk": {
    displayName: "Cyberpunk: Edgerunners",
    aliases: [],
  },
  "undead unluck": {
    displayName: "Undead Unluck",
    aliases: [],
  },
  "kaijuu 8-gou": {
    displayName: "Kaiju No. 8",
    aliases: [],
  },
  "wind breaker": {
    displayName: "Wind Breaker",
    aliases: [],
  },
  "youkoso jitsuryoku shijou shugi no kyoushitsu e": {
    displayName: "Classroom of the Elite",
    aliases: [],
  },
  "kusuriya no hitorigoto": {
    displayName: "The Apothecary Diaries",
    aliases: [],
  },
  "dungeon meshi": {
    displayName: "Delicious in Dungeon",
    aliases: [],
  },
  "shangri-la frontier": {
    displayName: "Shangri-La Frontier",
    aliases: [],
  },
  "fate/stay night": {
    displayName: "Fate/stay night",
    aliases: [],
  },
  "psycho-pass": {
    displayName: "Psycho-Pass",
    aliases: ["psycho-pass extended edition"],
  },
  "psycho-pass extended edition": {
    displayName: "Psycho-Pass",
    aliases: ["psycho-pass"],
  },
  "made in abyss": {
    displayName: "Made in Abyss",
    aliases: [],
  },
  "kiseijuu": {
    displayName: "Parasyte: The Maxim",
    aliases: [],
  },
  "boku dake ga inai machi": {
    displayName: "Erased",
    aliases: [],
  },
  "yakusoku no neverland": {
    displayName: "The Promised Neverland",
    aliases: [],
  },
  "dororo": {
    displayName: "Dororo",
    aliases: ["dororo to hyakkimaru"],
  },
  "dororo to hyakkimaru": {
    displayName: "Dororo",
    aliases: ["dororo"],
  },
  "dororonpa!": {
    displayName: "Dororonpa!",
    aliases: [],
  },
  "dororon enma-kun": {
    displayName: "Dororon Enma-kun",
    aliases: ["dororon enma-kun meeramera"],
  },
  "dororon enma-kun meeramera": {
    displayName: "Dororon Enma-kun",
    aliases: ["dororon enma-kun"],
  },
  "berserk": {
    displayName: "Berserk",
    aliases: ["kenpuu denki berserk", "berserk (2016)"],
  },
  "kenpuu denki berserk": {
    displayName: "Berserk",
    aliases: ["berserk", "berserk (2016)"],
  },
  "berserk (2016)": {
    displayName: "Berserk",
    aliases: ["berserk", "kenpuu denki berserk"],
  },
  "boushoku no berserk": {
    displayName: "Berserk of Gluttony",
    aliases: [],
  },
  "trigun": {
    displayName: "Trigun",
    aliases: ["trigun stampede", "trigun stargaze"],
  },
  "trigun stampede": {
    displayName: "Trigun",
    aliases: ["trigun", "trigun stargaze"],
  },
  "trigun stargaze": {
    displayName: "Trigun",
    aliases: ["trigun", "trigun stampede"],
  },
  "inuyasha": {
    displayName: "InuYasha",
    aliases: [],
  },
  "rurouni kenshin": {
    displayName: "Rurouni Kenshin",
    aliases: [],
  },
  "mortal bone demon slayer": {
    displayName: "Mortal Bone Demon Slayer",
    aliases: [],
  },
  "ao no miburo": {
    displayName: "Blue Miburo",
    aliases: [],
  },
  "dna sights 999.9": {
    displayName: "DNA Sights 999.9",
    aliases: [],
  },
  "doku tenshi no shippo": {
    displayName: "Doku Tenshi no Shippo",
    aliases: [],
  },
  "he wei dao x hui yeda xiaojie xiangyao wo gaobai": {
    displayName: "He Wei Dao x Hui Yeda",
    aliases: [],
  },
  "tokyo daigaku monogatari": {
    displayName: "Tokyo University Story",
    aliases: [],
  },
  "true tears": {
    displayName: "True Tears",
    aliases: [],
  },
  "ocha-ken": {
    displayName: "Ocha-ken",
    aliases: [],
  },
  "kuro no shoukanshi": {
    displayName: "Black Summoner",
    aliases: [],
  },
  "nihon animator mihonichi": {
    displayName: "Japan Animator Expo",
    aliases: [],
  },
  "serial experiments lain": {
    displayName: "Serial Experiments Lain",
    aliases: [],
  },
  "koukaku kidoutai": {
    displayName: "Ghost in the Shell: Stand Alone Complex",
    aliases: ["ghost in the shell"],
  },
  "ghost in the shell": {
    displayName: "Ghost in the Shell: Stand Alone Complex",
    aliases: ["koukaku kidoutai"],
  },
  "odd taxi": {
    displayName: "Odd Taxi",
    aliases: [],
  },
};

// Build reverse lookup: any alias or key -> canonical key
const aliasToCanonical = new Map<string, string>();
for (const [key, mapping] of Object.entries(SERIES_MAP)) {
  if (!aliasToCanonical.has(key)) {
    aliasToCanonical.set(key, key);
  }
  for (const alias of mapping.aliases) {
    if (!aliasToCanonical.has(alias)) {
      aliasToCanonical.set(alias, key);
    }
  }
}

// Build reverse lookup: English display name (lowercase) -> canonical key
const displayToCanonical = new Map<string, string>();
for (const [key, mapping] of Object.entries(SERIES_MAP)) {
  const lower = mapping.displayName.toLowerCase();
  if (!displayToCanonical.has(lower)) {
    displayToCanonical.set(lower, key);
  }
}

/**
 * Given a base name (from extractBaseName), return the canonical grouping key.
 * Multiple different base names that belong to the same series will return the same key.
 * Also checks English display names for reverse lookup.
 */
export function getSeriesKey(baseName: string): string {
  const lower = baseName.toLowerCase();
  // Check direct alias mapping
  const canonical = aliasToCanonical.get(lower);
  if (canonical) return canonical;
  // Check English display name → canonical key
  const fromDisplay = displayToCanonical.get(lower);
  if (fromDisplay) return fromDisplay;
  return lower;
}

/**
 * Given a base name (from extractBaseName), return the proper English display name.
 * Falls back to the original base name if no mapping exists.
 */
export function getDisplayName(baseName: string): string {
  const lower = baseName.toLowerCase();
  // Always resolve through canonical key for consistent naming within groups
  const canonical = aliasToCanonical.get(lower);
  if (canonical && SERIES_MAP[canonical]) {
    return SERIES_MAP[canonical].displayName;
  }
  // Direct match fallback
  const direct = SERIES_MAP[lower];
  if (direct) return direct.displayName;
  return baseName;
}

export function getSeriesGroupInfo(baseName: string, fullName = baseName) {
  const normalizedBase = baseName.toLowerCase();
  const normalizedFull = fullName.toLowerCase();
  const isNarutoFamily =
    /(naruto|nato|boruto)/i.test(fullName) ||
    [
      "naruto",
      "nato",
      "naruto shippuden",
      "naruto shippuuden",
      "nato shippuuden",
      "road of naruto",
      "naruto sd",
      "boruto",
    ].includes(normalizedBase);

  if (isNarutoFamily) {
    if (normalizedFull.includes("boruto") || normalizedBase === "boruto") {
      return { key: "boruto", displayName: "Boruto: Naruto Next Generations" };
    }

    if (
      normalizedFull.includes("shippuden") ||
      normalizedFull.includes("shippuuden") ||
      normalizedBase === "naruto shippuden" ||
      normalizedBase === "naruto shippuuden" ||
      normalizedBase === "nato shippuuden"
    ) {
      return { key: "naruto shippuden", displayName: "Naruto: Shippuden" };
    }

    if (
      normalizedFull.includes("road of naruto") ||
      normalizedFull.includes("naruto sd") ||
      (/(naruto|nato)/.test(normalizedFull) &&
        /(movie|ova|oad|special|gaiden|cross roads|yuki hime|konoha gakuen|dai katsugeki)/.test(
          normalizedFull
        ))
    ) {
      return { key: "naruto extras", displayName: "Naruto Extras" };
    }

    return { key: "naruto", displayName: "Naruto" };
  }

  return {
    key: getSeriesKey(baseName),
    displayName: getDisplayName(baseName),
  };
}

/**
 * Extract the season number from a full anime name.
 * e.g. "Jujutsu Kaisen 2nd Season" → 2, "Spy x Family Season 3" → 3
 * Falls back to 1 if no explicit season marker is found.
 */
export function extractSeasonNumber(fullName: string): number {
  // "Season X" or "Season: X"
  let m = fullName.match(/Season\s*:?\s*(\d+)/i);
  if (m) return parseInt(m[1]);

  // "Xst/nd/rd/th Season"
  m = fullName.match(/(\d+)(?:st|nd|rd|th)\s+Season/i);
  if (m) return parseInt(m[1]);

  // Roman numeral suffix: " II", " III", etc. (but not inside words)
  m = fullName.match(/\s(VIII|VII|VI|IV|V|III|II)\b/);
  if (m) {
    const roman: Record<string, number> = {
      II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
    };
    return roman[m[1]] ?? 1;
  }

  // "Part X" (e.g. "Dr. Stone: Science Future Part 2")
  m = fullName.match(/Part\s+(\d+)/i);
  if (m) return parseInt(m[1]);

  // "Xrd/nd Season" as number at end: "One Punch Man 3"
  m = fullName.match(/\s(\d+)$/);
  if (m && parseInt(m[1]) <= 20) return parseInt(m[1]);

  return 1;
}

/**
 * Check if a search result name is relevant to a given query.
 * Used by prefetch to filter out noise results from AllAnime searches.
 * Requires extractBaseName to be passed in to avoid circular dependency.
 */
export function isRelatedToQuery(
  query: string,
  resultName: string,
  extractBaseNameFn: (name: string) => string
): boolean {
  const queryLower = query.toLowerCase();
  const nameLower = resultName.toLowerCase();

  // Reject names with unusual Unicode (decorative text, emoji-style letters)
  if (/[\u{1F100}-\u{1F9FF}]/u.test(resultName)) return false;

  // Series key match (handles Japanese ↔ English name mapping)
  const queryKey = getSeriesKey(extractBaseNameFn(query));
  const resultKey = getSeriesKey(extractBaseNameFn(resultName));
  if (queryKey === resultKey) return true;

  // Result name starts with the query (strict prefix match)
  if (nameLower.startsWith(queryLower)) return true;

  // Result's base name starts with the query's base name
  const queryBase = extractBaseNameFn(query).toLowerCase();
  const resultBase = extractBaseNameFn(resultName).toLowerCase();
  if (resultBase.startsWith(queryBase)) return true;

  return false;
}
