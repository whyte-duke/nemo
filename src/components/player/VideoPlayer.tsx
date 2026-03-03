"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useUpdateProgress } from "@/hooks/use-watch-history";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  PictureInPicture2,
  Settings,
  Subtitles,
  Gauge,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubtitleTrack {
  src: string;
  label: string;
  language: string;
  default?: boolean;
}

export interface AudioTrack {
  index: number;
  label: string;
  language: string;
  codec?: string | null;
  default?: boolean;
}

interface VideoPlayerProps {
  url: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  title?: string;
  onBack?: () => void;
  className?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  /** Position de reprise en secondes */
  startTime?: number;
  /** Pistes de sous-titres depuis Jellyfin */
  subtitles?: SubtitleTrack[];
  /** Pistes audio depuis Jellyfin (affichage seulement) */
  audioTracks?: AudioTrack[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isHlsUrl(url: string): boolean {
  return url.includes(".m3u8");
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const SPEED_LABELS: Record<number, string> = {
  0.25: "0.25×",
  0.5: "0.5×",
  0.75: "0.75×",
  1: "Normale",
  1.25: "1.25×",
  1.5: "1.5×",
  2: "2×",
};

type SettingsPanel = null | "main" | "quality" | "speed" | "subtitles";
type CenterFlash = null | "play" | "pause" | "rewind" | "forward";

interface QualityLevel {
  height: number;
  bitrate: number;
  hlsIdx: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoPlayer({
  url,
  tmdbId,
  mediaType,
  title,
  onBack,
  className,
  seasonNumber,
  episodeNumber,
  startTime,
  subtitles = [],
  audioTracks = [],
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeAppliedRef = useRef(false);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const { mutate: updateProgress } = useUpdateProgress();

  // ── Playback state ────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);

  // ── Volume ────────────────────────────────────────────────────────────────
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nemo-volume");
      if (stored) return Math.max(0, Math.min(1, parseFloat(stored)));
    }
    return 1;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // ── Controls & UI ─────────────────────────────────────────────────────────
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // ── HLS Quality ───────────────────────────────────────────────────────────
  const [availableQualities, setAvailableQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = auto

  // ── Subtitles ─────────────────────────────────────────────────────────────
  const [activeSubtitleIdx, setActiveSubtitleIdx] = useState<number>(() => {
    if (!subtitles?.length) return -1;
    const defIdx = subtitles.findIndex((s) => s.default);
    return defIdx >= 0 ? defIdx : -1;
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);

  // ── UI Feedback ───────────────────────────────────────────────────────────
  const [centerFlash, setCenterFlash] = useState<CenterFlash>(null);
  const [seekPreview, setSeekPreview] = useState<{ time: number; pct: number } | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Progress save
  // ─────────────────────────────────────────────────────────────────────────
  const saveProgress = useCallback(
    (videoEl: HTMLVideoElement) => {
      if (!tmdbId || !mediaType || !videoEl.duration || videoEl.duration <= 0) return;
      const progress = Math.round((videoEl.currentTime / videoEl.duration) * 100);
      if (progress > 0 && progress < 100) {
        updateProgress({
          tmdbId,
          mediaType,
          progress,
          duration: Math.round(videoEl.duration),
          ...(mediaType === "tv" && { seasonNumber, episodeNumber }),
        });
      }
    },
    [tmdbId, mediaType, seasonNumber, episodeNumber, updateProgress]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Controls auto-hide
  // ─────────────────────────────────────────────────────────────────────────
  const showControlsTemporarily = useCallback((durationMs = 3000) => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowVolumeSlider(false);
    }, durationMs);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Center flash
  // ─────────────────────────────────────────────────────────────────────────
  const flashCenter = useCallback((type: NonNullable<CenterFlash>) => {
    setCenterFlash(null);
    requestAnimationFrame(() => setCenterFlash(type));
    setTimeout(() => setCenterFlash(null), 700);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Playback controls
  // ─────────────────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      flashCenter("play");
    } else {
      video.pause();
      flashCenter("pause");
    }
  }, [flashCenter]);

  const skip = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
      flashCenter(seconds > 0 ? "forward" : "rewind");
    },
    [flashCenter]
  );

  const changeVolume = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, v));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
    localStorage.setItem("nemo-volume", String(clamped));
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !video.muted;
    video.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted && video.volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
      localStorage.setItem("nemo-volume", "0.5");
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* fullscreen blocked */
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      /* PiP not supported */
    }
  }, []);

  const changeSubtitle = useCallback(
    (idx: number) => {
      const video = videoRef.current;
      if (video) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = i === idx ? "showing" : "hidden";
        }
      }
      setActiveSubtitleIdx(idx);
      setSettingsPanel(null);
    },
    []
  );

  const changeQuality = useCallback((hlsIdx: number) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = hlsIdx;
    setCurrentQuality(hlsIdx);
    setSettingsPanel(null);
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setSettingsPanel(null);
  }, []);

  const seekTo = useCallback((pct: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = Math.max(0, Math.min(video.duration, pct * video.duration));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          showControlsTemporarily();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          skip(-10);
          showControlsTemporarily();
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          skip(10);
          showControlsTemporarily();
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(volume + 0.1);
          showControlsTemporarily();
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(volume - 0.1);
          showControlsTemporarily();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          showControlsTemporarily();
          break;
        case "f":
        case "F":
          e.preventDefault();
          void toggleFullscreen();
          break;
        case "i":
        case "I":
          e.preventDefault();
          void togglePiP();
          break;
        case "Escape":
          if (settingsPanel) setSettingsPanel(null);
          break;
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [
    togglePlay,
    skip,
    changeVolume,
    volume,
    toggleMute,
    toggleFullscreen,
    togglePiP,
    showControlsTemporarily,
    settingsPanel,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // HLS + Video setup
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !url) return;

    startTimeAppliedRef.current = false;
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setAvailableQualities([]);
    setCurrentQuality(-1);
    setSettingsPanel(null);

    let destroyed = false;

    const applyStartTime = () => {
      if (
        startTime &&
        startTime > 0 &&
        !startTimeAppliedRef.current &&
        isFinite(videoEl.duration) &&
        videoEl.seekable.length > 0
      ) {
        const target = Math.min(startTime, videoEl.duration - 2);
        if (target > 0) {
          videoEl.currentTime = target;
          startTimeAppliedRef.current = true;
        }
      }
    };

    // ── Event listeners ──────────────────────────────────────────────────
    const onPlay = () => { if (!destroyed) setIsPlaying(true); };
    const onPause = () => {
      if (!destroyed) {
        setIsPlaying(false);
        saveProgress(videoEl);
      }
    };
    const onEnded = () => {
      if (!destroyed) {
        setIsPlaying(false);
        if (tmdbId && mediaType) {
          updateProgress({
            tmdbId,
            mediaType,
            progress: 100,
            ...(mediaType === "tv" && { seasonNumber, episodeNumber }),
          });
        }
      }
    };
    const onTimeUpdate = () => {
      if (!destroyed) {
        setCurrentTime(videoEl.currentTime);
        if (videoEl.buffered.length > 0) {
          setBuffered(videoEl.buffered.end(videoEl.buffered.length - 1));
        }
      }
    };
    const onDurationChange = () => {
      if (!destroyed && isFinite(videoEl.duration) && videoEl.duration > 0) {
        setDuration(videoEl.duration);
        applyStartTime();
      }
    };
    const onCanPlay = () => {
      if (!destroyed) {
        setIsLoading(false);
        applyStartTime();
      }
    };
    const onWaiting = () => { if (!destroyed) setIsBuffering(true); };
    const onPlaying = () => {
      if (!destroyed) {
        setIsBuffering(false);
        setIsPlaying(true);
      }
    };
    const onVolumeChange = () => {
      if (!destroyed) {
        setVolume(videoEl.volume);
        setIsMuted(videoEl.muted);
      }
    };
    const onFullscreenChange = () => {
      if (!destroyed) setIsFullscreen(!!document.fullscreenElement);
    };
    const onEnterPiP = () => { if (!destroyed) setIsPiP(true); };
    const onLeavePiP = () => { if (!destroyed) setIsPiP(false); };
    const onRateChange = () => {
      if (!destroyed) setPlaybackRate(videoEl.playbackRate);
    };

    videoEl.addEventListener("play", onPlay);
    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("ended", onEnded);
    videoEl.addEventListener("timeupdate", onTimeUpdate);
    videoEl.addEventListener("durationchange", onDurationChange);
    videoEl.addEventListener("canplay", onCanPlay);
    videoEl.addEventListener("waiting", onWaiting);
    videoEl.addEventListener("playing", onPlaying);
    videoEl.addEventListener("volumechange", onVolumeChange);
    videoEl.addEventListener("ratechange", onRateChange);
    videoEl.addEventListener("enterpictureinpicture", onEnterPiP);
    videoEl.addEventListener("leavepictureinpicture", onLeavePiP);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    // Apply stored volume
    videoEl.volume = volume;

    // ── HLS.js or native ────────────────────────────────────────────────
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;

      if (isHlsUrl(url) && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          startLevel: -1,
          abrEwmaDefaultEstimate: 5_000_000,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          lowLatencyMode: false,
        });

        hls.loadSource(url);
        hls.attachMedia(videoEl);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hls.on(Hls.Events.MANIFEST_PARSED, (_: unknown, data: any) => {
          if (destroyed) return;

          // Extract unique quality levels
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const seen = new Set<number>();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const levels: QualityLevel[] = (data.levels as any[])
            .map((l: { height: number; bitrate: number }, idx: number) => ({
              height: l.height || 0,
              bitrate: l.bitrate || 0,
              hlsIdx: idx,
            }))
            .filter((l: QualityLevel) => {
              if (seen.has(l.height)) return false;
              seen.add(l.height);
              return true;
            })
            .sort((a: QualityLevel, b: QualityLevel) => b.height - a.height);

          setAvailableQualities(levels);
          applyStartTime();
          void videoEl.play();
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hls.on(Hls.Events.ERROR, (_: unknown, data: any) => {
          if (data.fatal) {
            console.error("[HLS Fatal]", data.type, data.details);
            if (data.type === "networkError") {
              hls.startLoad();
            } else if (data.type === "mediaError") {
              hls.recoverMediaError();
            }
          }
        });

        hlsRef.current = hls;
      } else if (videoEl.canPlayType("application/vnd.apple.mpegurl") && isHlsUrl(url)) {
        // Safari native HLS
        videoEl.src = url;
        videoEl.addEventListener("loadedmetadata", () => {
          if (!destroyed) applyStartTime();
        }, { once: true });
        void videoEl.play();
      } else {
        // Direct play (MP4, WebM…)
        videoEl.src = url;
        videoEl.addEventListener("loadedmetadata", () => {
          if (!destroyed) applyStartTime();
        }, { once: true });
        void videoEl.play();
      }
    });

    // Progress save every 30s
    progressIntervalRef.current = setInterval(() => {
      if (!destroyed) saveProgress(videoEl);
    }, 30_000);

    return () => {
      destroyed = true;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      saveProgress(videoEl);

      videoEl.removeEventListener("play", onPlay);
      videoEl.removeEventListener("pause", onPause);
      videoEl.removeEventListener("ended", onEnded);
      videoEl.removeEventListener("timeupdate", onTimeUpdate);
      videoEl.removeEventListener("durationchange", onDurationChange);
      videoEl.removeEventListener("canplay", onCanPlay);
      videoEl.removeEventListener("waiting", onWaiting);
      videoEl.removeEventListener("playing", onPlaying);
      videoEl.removeEventListener("volumechange", onVolumeChange);
      videoEl.removeEventListener("ratechange", onRateChange);
      videoEl.removeEventListener("enterpictureinpicture", onEnterPiP);
      videoEl.removeEventListener("leavepictureinpicture", onLeavePiP);
      document.removeEventListener("fullscreenchange", onFullscreenChange);

      hlsRef.current?.destroy();
      hlsRef.current = null;
      videoEl.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Sync subtitle tracks when subtitles prop changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const syncTracks = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === activeSubtitleIdx ? "showing" : "hidden";
      }
    };
    // Small delay to let <track> elements load
    const t = setTimeout(syncTracks, 100);
    return () => clearTimeout(t);
  }, [activeSubtitleIdx, subtitles]);

  // Show controls on mount
  useEffect(() => {
    showControlsTemporarily(4000);
  }, [showControlsTemporarily]);

  // ─────────────────────────────────────────────────────────────────────────
  // Touch events (mobile)
  // ─────────────────────────────────────────────────────────────────────────
  const handleContainerTouch = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Don't handle taps on controls
      if ((e.target as HTMLElement).closest("[data-player-controls]")) return;

      const now = Date.now();
      const touch = e.changedTouches[0];
      const containerWidth = containerRef.current?.clientWidth ?? 1;
      const zone = touch.clientX / containerWidth;

      if (lastTapRef.current && now - lastTapRef.current.time < 300) {
        // Double-tap
        if (zone < 0.35) {
          skip(-10);
        } else if (zone > 0.65) {
          skip(10);
        } else {
          togglePlay();
        }
        lastTapRef.current = null;
        showControlsTemporarily();
      } else {
        lastTapRef.current = { time: now, x: touch.clientX };
        if (showControls) {
          setShowControls(false);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        } else {
          showControlsTemporarily();
        }
      }
    },
    [skip, togglePlay, showControls, showControlsTemporarily]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Progress bar interactions
  // ─────────────────────────────────────────────────────────────────────────
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(pct);
    },
    [seekTo]
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setSeekPreview({ time: pct * duration, pct });
    },
    [duration]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────────────────
  const playedPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  const currentQualityLabel =
    currentQuality === -1
      ? "Auto"
      : availableQualities.find((q) => q.hlsIdx === currentQuality)?.height
        ? `${availableQualities.find((q) => q.hlsIdx === currentQuality)!.height}p`
        : "Auto";

  const activeSubLabel =
    activeSubtitleIdx >= 0 ? (subtitles[activeSubtitleIdx]?.label ?? "Actif") : "Désactivé";

  const currentSpeedLabel = SPEED_LABELS[playbackRate] ?? `${playbackRate}×`;

  const VolumeIcon =
    isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black select-none overflow-hidden focus:outline-none",
        className
      )}
      style={{ width: "100%", height: "100%" }}
      tabIndex={0}
      onMouseMove={() => showControlsTemporarily()}
      onMouseLeave={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setShowControls(false);
          setShowVolumeSlider(false);
          setSettingsPanel(null);
        }, 1000);
      }}
      onTouchEnd={handleContainerTouch}
      onClick={(e) => {
        // Close settings on backdrop click
        if (settingsPanel && !(e.target as HTMLElement).closest("[data-settings-panel]")) {
          setSettingsPanel(null);
        }
      }}
    >
      {/* ── Video element ────────────────────────────────────────────────── */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        onDoubleClick={(e) => {
          // Desktop double-click fullscreen
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const zone = (e.clientX - rect.left) / rect.width;
          if (zone < 0.35) skip(-10);
          else if (zone > 0.65) skip(10);
          else void toggleFullscreen();
        }}
      >
        {subtitles.map((track, i) => (
          <track
            key={`${track.language}-${i}`}
            kind="subtitles"
            src={track.src}
            srcLang={track.language}
            label={track.label}
          />
        ))}
      </video>

      {/* ── Initial loading overlay ──────────────────────────────────────── */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
          <div className="relative flex items-center justify-center size-16">
            <div className="absolute inset-0 rounded-full border-2 border-white/8" />
            <div className="absolute inset-0 rounded-full border-2 border-t-nemo-accent border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <Loader2 className="size-5 text-nemo-accent/60 animate-spin" />
          </div>
          {title && (
            <p className="mt-4 text-white/50 text-sm font-medium max-w-xs text-center truncate px-4">
              {title}
            </p>
          )}
        </div>
      )}

      {/* ── Mid-playback buffering bar ───────────────────────────────────── */}
      {isBuffering && !isLoading && (
        <div className="absolute top-0 left-0 right-0 h-0.75 z-30 overflow-hidden bg-white/5">
          <div
            className="absolute inset-y-0 w-2/5 bg-nemo-accent/80 rounded-full"
            style={{ animation: "nemo-buffer 1.6s ease-in-out infinite" }}
          />
        </div>
      )}

      {/* ── Center flash feedback ────────────────────────────────────────── */}
      {centerFlash && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            className="flex flex-col items-center justify-center gap-1 size-24 rounded-full bg-black/50 backdrop-blur-sm"
            style={{ animation: "nemo-flash 0.65s ease-out forwards" }}
          >
            {centerFlash === "play" && <Play className="size-9 fill-white text-white ml-1" />}
            {centerFlash === "pause" && <Pause className="size-9 fill-white text-white" />}
            {centerFlash === "rewind" && (
              <>
                <RotateCcw className="size-7 text-white" />
                <span className="text-white text-xs font-bold">10s</span>
              </>
            )}
            {centerFlash === "forward" && (
              <>
                <RotateCw className="size-7 text-white" />
                <span className="text-white text-xs font-bold">10s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Settings panel ───────────────────────────────────────────────── */}
      {settingsPanel && (
        <div
          data-settings-panel
          className="absolute bottom-24 right-4 z-40 min-w-52 rounded-2xl bg-[#0d0f18]/96 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Main menu */}
          {settingsPanel === "main" && (
            <div className="py-1.5">
              {availableQualities.length > 0 && (
                <button
                  onClick={() => setSettingsPanel("quality")}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors"
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <svg className="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    Qualité
                  </span>
                  <span className="flex items-center gap-1 text-white/35 text-xs">
                    {currentQualityLabel}
                    <ChevronRight className="size-3.5" />
                  </span>
                </button>
              )}
              <button
                onClick={() => setSettingsPanel("speed")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Gauge className="size-4 opacity-60" />
                  Vitesse
                </span>
                <span className="flex items-center gap-1 text-white/35 text-xs">
                  {currentSpeedLabel}
                  <ChevronRight className="size-3.5" />
                </span>
              </button>
              {subtitles.length > 0 && (
                <button
                  onClick={() => setSettingsPanel("subtitles")}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors"
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <Subtitles className="size-4 opacity-60" />
                    Sous-titres
                  </span>
                  <span className="flex items-center gap-1 text-white/35 text-xs">
                    {activeSubLabel}
                    <ChevronRight className="size-3.5" />
                  </span>
                </button>
              )}
              {audioTracks.length > 0 && (
                <div className="px-4 pt-2 pb-1.5 border-t border-white/6 mt-1">
                  <p className="text-white/30 text-xs font-medium mb-1.5">Pistes audio</p>
                  {audioTracks.map((track) => (
                    <div
                      key={track.index}
                      className="flex items-center gap-2 py-1 text-xs text-white/50"
                    >
                      {track.default && <Check className="size-3 text-nemo-accent shrink-0" />}
                      {!track.default && <span className="size-3 shrink-0" />}
                      <span>{track.label}</span>
                      {track.codec && (
                        <span className="text-white/25 border border-white/10 px-1 rounded text-[10px]">
                          {track.codec.toUpperCase()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quality sub-menu */}
          {settingsPanel === "quality" && (
            <div className="py-1.5">
              <button
                onClick={() => setSettingsPanel("main")}
                className="flex items-center gap-1.5 px-4 py-2 text-xs text-white/40 hover:text-white/60 transition-colors w-full"
              >
                <ChevronLeft className="size-3.5" />
                Paramètres
              </button>
              <div className="border-t border-white/6 pt-1">
                <button
                  onClick={() => changeQuality(-1)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/6 transition-colors"
                >
                  <span className={cn("font-medium", currentQuality === -1 ? "text-nemo-accent" : "text-white/70")}>
                    Auto
                  </span>
                  {currentQuality === -1 && <Check className="size-4 text-nemo-accent" />}
                </button>
                {availableQualities.map((q) => (
                  <button
                    key={q.hlsIdx}
                    onClick={() => changeQuality(q.hlsIdx)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/6 transition-colors"
                  >
                    <span className={cn("flex items-center gap-2 font-medium", currentQuality === q.hlsIdx ? "text-nemo-accent" : "text-white/70")}>
                      {q.height > 0 ? `${q.height}p` : "SD"}
                      {q.height >= 2160 && (
                        <span className="text-[10px] text-nemo-accent border border-nemo-accent/40 px-1 py-px rounded">4K</span>
                      )}
                      {q.height >= 1080 && q.height < 2160 && (
                        <span className="text-[10px] text-blue-400 border border-blue-400/40 px-1 py-px rounded">HD</span>
                      )}
                    </span>
                    {currentQuality === q.hlsIdx && <Check className="size-4 text-nemo-accent" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Speed sub-menu */}
          {settingsPanel === "speed" && (
            <div className="py-1.5">
              <button
                onClick={() => setSettingsPanel("main")}
                className="flex items-center gap-1.5 px-4 py-2 text-xs text-white/40 hover:text-white/60 transition-colors w-full"
              >
                <ChevronLeft className="size-3.5" />
                Paramètres
              </button>
              <div className="border-t border-white/6 pt-1">
                {SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => changeSpeed(speed)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/6 transition-colors"
                  >
                    <span className={cn("font-medium", playbackRate === speed ? "text-nemo-accent" : "text-white/70")}>
                      {SPEED_LABELS[speed]}
                    </span>
                    {playbackRate === speed && <Check className="size-4 text-nemo-accent" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtitles sub-menu */}
          {settingsPanel === "subtitles" && (
            <div className="py-1.5">
              <button
                onClick={() => setSettingsPanel("main")}
                className="flex items-center gap-1.5 px-4 py-2 text-xs text-white/40 hover:text-white/60 transition-colors w-full"
              >
                <ChevronLeft className="size-3.5" />
                Paramètres
              </button>
              <div className="border-t border-white/6 pt-1">
                <button
                  onClick={() => changeSubtitle(-1)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/6 transition-colors"
                >
                  <span className={cn("font-medium", activeSubtitleIdx === -1 ? "text-nemo-accent" : "text-white/70")}>
                    Désactivé
                  </span>
                  {activeSubtitleIdx === -1 && <Check className="size-4 text-nemo-accent" />}
                </button>
                {subtitles.map((sub, i) => (
                  <button
                    key={i}
                    onClick={() => changeSubtitle(i)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/6 transition-colors"
                  >
                    <span className={cn("font-medium", activeSubtitleIdx === i ? "text-nemo-accent" : "text-white/70")}>
                      {sub.label}
                    </span>
                    {activeSubtitleIdx === i && <Check className="size-4 text-nemo-accent" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div
        data-player-controls
        className={cn(
          "absolute top-0 left-0 right-0 z-10 px-4 pt-4 pb-14",
          "bg-linear-to-b from-black/85 via-black/30 to-transparent",
          "transition-opacity duration-300 pointer-events-none",
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0"
        )}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBack();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-sm font-medium transition-all backdrop-blur-sm"
            >
              <ArrowLeft className="size-4" />
              Retour
            </button>
          )}
          {title && (
            <span className="text-white/80 text-sm font-medium truncate drop-shadow-md">
              {title}
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      <div
        data-player-controls
        className={cn(
          "absolute bottom-0 left-0 right-0 z-10",
          "bg-linear-to-t from-black/90 via-black/40 to-transparent",
          "pt-20 pb-3 px-3",
          "transition-opacity duration-300",
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Progress bar */}
        <div
          ref={progressBarRef}
          className="relative h-5 flex items-center cursor-pointer group mb-1"
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setSeekPreview(null)}
          onClick={handleProgressClick}
        >
          {/* Time tooltip on hover */}
          {seekPreview && (
            <div
              className="absolute bottom-5 -translate-x-1/2 bg-[#0d0f18]/95 border border-white/12 text-white text-xs font-mono px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap shadow-xl"
              style={{ left: `clamp(24px, ${seekPreview.pct * 100}%, calc(100% - 24px))` }}
            >
              {formatTime(seekPreview.time)}
            </div>
          )}

          {/* Track background */}
          <div className="absolute inset-x-0 h-0.75 group-hover:h-1.25 transition-all duration-150 rounded-full bg-white/15 overflow-hidden">
            {/* Buffered */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/22 rounded-full"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Played */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-nemo-accent rounded-full"
              style={{ width: `${playedPct}%` }}
            />
          </div>

          {/* Playhead thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-nemo-accent shadow-lg shadow-nemo-accent/30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
            style={{ left: `${playedPct}%` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1">
          {/* Play / Pause */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 text-white transition-colors"
            aria-label={isPlaying ? "Pause" : "Lecture"}
          >
            {isPlaying
              ? <Pause className="size-5 fill-white" />
              : <Play className="size-5 fill-white ml-0.5" />
            }
          </button>

          {/* Rewind 10s */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              skip(-10);
            }}
            className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 text-white transition-colors"
            aria-label="Reculer 10s"
          >
            <RotateCcw className="size-4.5" />
          </button>

          {/* Forward 10s */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              skip(10);
            }}
            className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 text-white transition-colors"
            aria-label="Avancer 10s"
          >
            <RotateCw className="size-4.5" />
          </button>

          {/* Time */}
          <span className="text-white/65 text-xs font-mono tabular-nums ml-1 whitespace-nowrap">
            {formatTime(currentTime)}
            <span className="text-white/30 mx-1">/</span>
            {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Volume */}
          <div
            className="relative flex items-center group/vol"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            {/* Horizontal volume slider (expands on hover) */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                showVolumeSlider ? "w-20 opacity-100 mr-1" : "w-0 opacity-0"
              )}
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="nemo-range w-20 cursor-pointer"
                aria-label="Volume"
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 text-white transition-colors"
              aria-label={isMuted ? "Activer le son" : "Couper le son"}
            >
              <VolumeIcon className="size-4.5" />
            </button>
          </div>

          {/* Settings */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSettingsPanel(settingsPanel ? null : "main");
            }}
            className={cn(
              "flex items-center justify-center size-9 rounded-full hover:bg-white/10 text-white transition-colors",
              settingsPanel && "bg-white/10 text-nemo-accent"
            )}
            aria-label="Paramètres"
          >
            <Settings className="size-4.5" />
          </button>

          {/* PiP */}
          {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void togglePiP();
              }}
              className={cn(
                "flex items-center justify-center size-9 rounded-full hover:bg-white/10 text-white transition-colors",
                isPiP && "text-nemo-accent"
              )}
              aria-label="Image dans l'image"
            >
              <PictureInPicture2 className="size-4.5" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void toggleFullscreen();
            }}
            className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 text-white transition-colors"
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen
              ? <Minimize className="size-4.5" />
              : <Maximize className="size-4.5" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
