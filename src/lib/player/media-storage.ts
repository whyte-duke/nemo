import type { MediaStorage, SerializedVideoQuality } from "@vidstack/react";

/**
 * NemoMediaStorage — implements Vidstack's MediaStorage interface.
 *
 * Strategy:
 * - Time (position): `getTime()` returns `initialTime` (from Supabase `last_position_seconds`).
 *   `setTime()` persists to localStorage for within-session reliability.
 *   Supabase persistence is handled by ProgressSaver component in NemoPlayer.
 *
 * - Volume, muted, playback rate: GLOBAL (shared across all media).
 *   Stored under `nemo-player:global:*` so the user's volume/mute preference
 *   persists regardless of which film they watch.
 *
 * - Quality, gain, lang, captions: per-media (tied to the media key).
 */

const GLOBAL = "nemo-player:global";

function ls(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

export class NemoMediaStorage implements MediaStorage {
  private readonly _prefix: string;
  private readonly _initialTime: number;

  constructor(storageKey: string, initialTime = 0) {
    this._prefix = `nemo-player:${storageKey}`;
    this._initialTime = initialTime;
  }

  private _key(k: string) {
    return `${this._prefix}:${k}`;
  }

  private _get(k: string): string | null {
    return ls(this._key(k));
  }

  private _set(k: string, v: string): void {
    lsSet(this._key(k), v);
  }

  private _del(k: string): void {
    try {
      localStorage.removeItem(this._key(k));
    } catch {
      /* noop */
    }
  }

  // ── Time ──────────────────────────────────────────────────────────────────

  async getTime(): Promise<number | null> {
    return this._initialTime > 0 ? this._initialTime : null;
  }

  async setTime(time: number, ended?: boolean): Promise<void> {
    this._set("t", ended ? "0" : String(Math.floor(time)));
  }

  // ── Volume — GLOBAL, default 1 (audible) ───────────────────────────────────

  async getVolume(): Promise<number | null> {
    const v = ls(`${GLOBAL}:vol`);
    if (v === null) return 1;
    const n = parseFloat(v);
    return isNaN(n) ? 1 : Math.max(0, Math.min(1, n));
  }

  async setVolume(volume: number): Promise<void> {
    lsSet(`${GLOBAL}:vol`, String(volume));
  }

  // ── Muted — GLOBAL, default false (unmuted) ────────────────────────────────

  async getMuted(): Promise<boolean | null> {
    const v = ls(`${GLOBAL}:muted`);
    return v === "true" ? true : false;
  }

  async setMuted(muted: boolean): Promise<void> {
    lsSet(`${GLOBAL}:muted`, String(muted));
  }

  // ── Playback rate — GLOBAL ────────────────────────────────────────────────

  async getPlaybackRate(): Promise<number | null> {
    const v = ls(`${GLOBAL}:rate`);
    if (v === null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  async setPlaybackRate(rate: number): Promise<void> {
    lsSet(`${GLOBAL}:rate`, String(rate));
  }

  // ── Video quality ─────────────────────────────────────────────────────────

  async getVideoQuality(): Promise<SerializedVideoQuality | null> {
    const v = this._get("quality");
    if (v === null) return null;
    try {
      return JSON.parse(v) as SerializedVideoQuality;
    } catch {
      return null;
    }
  }

  async setVideoQuality(quality: SerializedVideoQuality | null): Promise<void> {
    if (quality === null) {
      this._del("quality");
    } else {
      this._set("quality", JSON.stringify(quality));
    }
  }

  // ── Audio gain ────────────────────────────────────────────────────────────

  async getAudioGain(): Promise<number | null> {
    const v = this._get("gain");
    if (v === null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  async setAudioGain(gain: number | null): Promise<void> {
    if (gain === null) {
      this._del("gain");
    } else {
      this._set("gain", String(gain));
    }
  }

  // ── Language ──────────────────────────────────────────────────────────────

  async getLang(): Promise<string | null> {
    return this._get("lang");
  }

  async setLang(lang: string | null): Promise<void> {
    if (lang === null) {
      this._del("lang");
    } else {
      this._set("lang", lang);
    }
  }

  // ── Captions enabled ──────────────────────────────────────────────────────

  async getCaptions(): Promise<boolean | null> {
    const v = this._get("captions");
    return v === null ? null : v === "true";
  }

  async setCaptions(enabled: boolean): Promise<void> {
    this._set("captions", String(enabled));
  }
}
