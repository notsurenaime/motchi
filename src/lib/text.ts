export function formatTextContent(text?: string) {
  if (!text) return "";

  const withSpacing = text
    .replace(/<note-split>/gi, " - ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]*>/g, " ");

  const parser = new DOMParser();
  const decoded = parser.parseFromString(withSpacing, "text/html").documentElement
    .textContent ?? "";

  return decoded
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .trim();
}