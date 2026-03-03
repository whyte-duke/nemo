/**
 * Génère le contenu M3U pour un flux et déclenche le téléchargement côté client.
 * L’utilisateur ouvre le fichier .m3u dans VLC pour lire le flux.
 * mediaTitle = nom du film/série (affiché dans VLC et utilisé pour le nom du fichier).
 */

import type { ParsedStream } from "@/types/stremio";

function slugify(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80) || "stream";
}

function escapeM3U(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildM3UContent(stream: ParsedStream, mediaTitle?: string): string {
  const lines = ["#EXTM3U"];
  const displayName = mediaTitle?.trim() || stream.name;
  const label = `${displayName} [${stream.quality}] [${stream.language}]`;
  lines.push(
    `#EXTINF:-1 tvg-name="${escapeM3U(displayName)}" group-title="${stream.quality}" language="${stream.language}",${label}`
  );
  lines.push(stream.url);
  return lines.join("\n");
}

export function downloadM3U(stream: ParsedStream, mediaTitle?: string): void {
  const displayName = mediaTitle?.trim() || stream.name;
  const content = buildM3UContent(stream, mediaTitle);
  const filename = `${slugify(displayName)}.m3u`;
  const blob = new Blob([content], { type: "audio/x-mpegurl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
