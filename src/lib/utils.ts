import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}min` : `${m}min`;
}

export function formatYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).getFullYear().toString();
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function formatVoteAverage(vote: number): string {
  return vote.toFixed(1);
}

export function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function formatFileSize(mb: number | null): string {
  if (!mb) return "";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} Go`;
  return `${mb} Mo`;
}

export function getLanguageFlag(lang: string): string {
  const flags: Record<string, string> = {
    VF: "🇫🇷",
    VFF: "🇫🇷",
    VOSTFR: "🇫🇷",
    MULTI: "🌐",
    VO: "🇬🇧",
    EN: "🇬🇧",
  };
  return flags[lang.toUpperCase()] ?? "🌐";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}
