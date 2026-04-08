const SAFE_TEXT_RE = /\s+/g;

export function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(SAFE_TEXT_RE, " ");
  if (!normalized || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

export function normalizeOptionalText(
  value: unknown,
  maxLength: number
): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  return normalizeText(value, maxLength) ?? undefined;
}

export function isValidEpisodeNumber(value: unknown): value is string {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim());
}

export function sanitizeFileNameSegment(value: string, maxLength = 120): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, maxLength) || "episode"
  );
}

/** Escape SQL LIKE special characters so user input is treated literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

/** Validate that mode is "sub" or "dub", defaulting to "sub". */
export function validateMode(value: unknown): "sub" | "dub" {
  return value === "dub" ? "dub" : "sub";
}

export function isAllowedProxyUrl(rawUrl: string, allowedHosts: string[]) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { ok: false as const, reason: "Invalid URL" };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { ok: false as const, reason: "Unsupported protocol" };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const allowed = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );

  if (!allowed) {
    return { ok: false as const, reason: "Host not allowed" };
  }

  return { ok: true as const, url: parsedUrl };
}