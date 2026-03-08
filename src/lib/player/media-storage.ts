import type { MediaStorage, SerializedVideoQuality } from "@vidstack/react";

/**
 * NemoMediaStorage — implements Vidstack's MediaStorage interface.
 *
 * Strategy:
 * - Time (position): `getTime()` returns `initialTime` (from Supabase `last_position_seconds`).
 *   `setTime()` persists to localStorage for within-session reliability.
 *   Supabase persistence is handled by ProgressSaver component in NemoPlayer.
 * - Volume, muted, playback rate, quality, gain, lang, captions: localStorage only.
 */
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
    try {
      return localStorage.getItem(this._key(k));
    } catch {
      return null;
    }
  }

  private _set(k: string, v: string): void {
    try {
      localStorage.setItem(this._key(k), v);
    } catch {
      // localStorage unavailable or full
    }
  }

  private _del(k: string): void {
    try {
      localStorage.removeItem(this._key(k));
    } catch {
      // noop
    }
  }

  // ── Time ──────────────────────────────────────────────────────────────────

  async getTime(): Promise<number | null> {
    return this._initialTime > 0 ? this._initialTime : null;
  }

  async setTime(time: number, ended?: boolean): Promise<void> {
    this._set("t", ended ? "0" : String(Math.floor(time)));
  }

  // ── Volume ────────────────────────────────────────────────────────────────

  async getVolume(): Promise<number | null> {
    const v = this._get("vol");
    if (v === null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : Math.max(0, Math.min(1, n));
  }

  async setVolume(volume: number): Promise<void> {
    this._set("vol", String(volume));
  }

  // ── Muted ─────────────────────────────────────────────────────────────────

  async getMuted(): Promise<boolean | null> {
    const v = this._get("muted");
    if (v === null) return false; // Default to unmuted — prevents accumulation of muted state
    return v === "true";
  }

  async setMuted(muted: boolean): Promise<void> {
    this._set("muted", String(muted));
  }

  // ── Playback rate ─────────────────────────────────────────────────────────

  async getPlaybackRate(): Promise<number | null> {
    const v = this._get("rate");
    if (v === null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this._set("rate", String(rate));
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
