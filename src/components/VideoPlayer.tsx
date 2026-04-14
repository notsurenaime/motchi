import { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import Hls from "hls.js";
import { getApiUrl } from "@/lib/api";
import type { SkipTime } from "@/lib/types";

interface VideoPlayerProps {
  url: string;
  title: string;
  episodeNumber: string;
  animeId: string;
  skipTimes?: SkipTime[];
  onProgress?: (current: number, duration: number) => void;
  onDurationKnown?: (duration: number) => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  initialTime?: number;
  isHls?: boolean;
  referer?: string;
}

function VideoPlayer({
  url,
  title,
  episodeNumber,
  animeId,
  skipTimes = [],
  onProgress,
  onDurationKnown,
  onNextEpisode,
  onPrevEpisode,
  initialTime = 0,
  isHls = false,
  referer,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasInitialSeeked = useRef(false);
  const onProgressRef = useRef(onProgress);
  const onDurationKnownRef = useRef(onDurationKnown);
  const lastReportedDurationRef = useRef(0);

  // Lock props at mount to prevent re-renders from changing the source
  const lockedUrl = useRef(url);
  const lockedIsHls = useRef(isHls);
  const lockedReferer = useRef(referer);
  const playingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSkip, setActiveSkip] = useState<SkipTime | null>(null);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Show/hide controls — use ref so this callback never changes identity
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (playingRef.current) setShowControls(false);
    }, 3000);
  }, []);

  // Keep onProgress ref current
  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    onDurationKnownRef.current = onDurationKnown;
  });

  // Setup video source — HLS.js or direct mp4
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const srcUrl = lockedUrl.current;
    const srcIsHls = lockedIsHls.current;
    const srcReferer = lockedReferer.current;

    if (srcIsHls && Hls.isSupported()) {
      const hls = new Hls({
        ...(srcReferer
          ? {
              xhrSetup: (xhr: XMLHttpRequest, hlsUrl: string) => {
                const proxyUrl = getApiUrl(
                  `/proxy/stream?url=${encodeURIComponent(hlsUrl)}&referer=${encodeURIComponent(srcReferer)}`
                );
                xhr.open("GET", proxyUrl, true);
              },
            }
          : {}),
      });
      hls.loadSource(srcUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        vid.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError("Fatal stream error. Please try again.");
              break;
          }
        }
      });
      hlsRef.current = hls;
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (
      srcIsHls &&
      vid.canPlayType("application/vnd.apple.mpegurl")
    ) {
      // Safari native HLS
      vid.src = srcUrl;
      vid.play().catch(() => {});
    } else {
      // MP4 or direct playback
      vid.src = srcUrl;
      vid.play().catch(() => {});
    }

    // Cleanup: release video resources on unmount to prevent lingering streams
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      vid.pause();
      vid.removeAttribute("src");
      // Do NOT call vid.load() here — it fires error/abort events during unmount
    };
  }, []); // only on mount — lockedUrl is a ref

  // Progress reporting — only every 5 seconds to avoid excessive network calls
  // Initialize to now so the first report is delayed, not immediate
  const lastProgressReportRef = useRef(performance.now());
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const handler = () => {
      if (
        vid.duration > 0 &&
        isFinite(vid.duration) &&
        onProgressRef.current
      ) {
        const now = performance.now();
        if (now - lastProgressReportRef.current < 5000) return;
        lastProgressReportRef.current = now;
        onProgressRef.current(vid.currentTime, vid.duration);
      }
    };
    vid.addEventListener("timeupdate", handler);
    return () => vid.removeEventListener("timeupdate", handler);
  }, []);

  // Seek to initial time — only once
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || hasInitialSeeked.current || initialTime <= 0) return;
    const doSeek = () => {
      if (
        !hasInitialSeeked.current &&
        vid.duration > 0 &&
        isFinite(vid.duration)
      ) {
        vid.currentTime = initialTime;
        hasInitialSeeked.current = true;
      }
    };
    if (
      vid.readyState >= 2 &&
      vid.duration > 0 &&
      isFinite(vid.duration)
    ) {
      doSeek();
    } else {
      vid.addEventListener("canplay", doSeek, { once: true });
      return () => vid.removeEventListener("canplay", doSeek);
    }
  }, [initialTime]);

  // Check for active skip times
  useEffect(() => {
    const skip = skipTimes.find(
      (s) => currentTime >= s.startTime && currentTime < s.endTime
    );
    setActiveSkip(skip ?? null);
  }, [currentTime, skipTimes]);

  // Keyboard shortcuts — uses videoRef.current directly, never a stale const
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const vid = videoRef.current;
      if (!vid) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          vid.paused ? vid.play() : vid.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          vid.currentTime = Math.min(
            vid.duration || 0,
            vid.currentTime + 10
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          setMuted((m) => !m);
          break;
      }
      resetHideTimer();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [resetHideTimer]);

  // Sync volume
  useEffect(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.volume = volume;
      vid.muted = muted;
    }
  }, [volume, muted]);

  // Sync playback rate
  useEffect(() => {
    const vid = videoRef.current;
    if (vid) vid.playbackRate = playbackRate;
  }, [playbackRate]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleSkip = () => {
    const vid = videoRef.current;
    if (vid && activeSkip) {
      vid.currentTime = activeSkip.endTime;
    }
  };

  const handleSkipClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      handleSkip();
    },
    [activeSkip]
  );

  // Stable event handlers that always read from videoRef.current
  // Throttle timeupdate to ~2/second to reduce re-renders
  const lastTimeUpdateRef = useRef(0);
  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const now = performance.now();
    if (now - lastTimeUpdateRef.current < 500) return;
    lastTimeUpdateRef.current = now;
    setCurrentTime(vid.currentTime);
  }, []);

  const handleDurationChange = useCallback(() => {
    const vid = videoRef.current;
    if (vid && isFinite(vid.duration) && vid.duration > 0) {
      setDuration(vid.duration);
      const roundedDuration = Math.round(vid.duration);
      if (lastReportedDurationRef.current !== roundedDuration) {
        lastReportedDurationRef.current = roundedDuration;
        onDurationKnownRef.current?.(roundedDuration);
      }
    }
  }, []);

  const getSkipLabel = useCallback((skip: SkipTime) => {
    switch (skip.type) {
      case "op":
      case "mixed-op":
        return "Intro";
      case "ed":
      case "mixed-ed":
        return "Outro";
      case "recap":
        return "Recap";
      default:
        return "Segment";
    }
  }, []);

  const handleBufferProgress = useCallback(() => {
    const vid = videoRef.current;
    if (vid && vid.buffered.length > 0) {
      setBuffered(vid.buffered.end(vid.buffered.length - 1));
    }
  }, []);

  const handleEnded = useCallback(() => {
    const vid = videoRef.current;
    if (vid && onProgressRef.current) {
      onProgressRef.current(vid.currentTime, vid.duration);
    }
    onNextEpisode?.();
  }, [onNextEpisode]);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    playingRef.current = true;
  }, []);

  const handlePause = useCallback(() => {
    setPlaying(false);
    playingRef.current = false;
  }, []);

  const handleError = useCallback(() => {
    const vid = videoRef.current;
    if (!vid?.error) return;
    // ABORTED is normal during seeking / source switching / range requests
    if (vid.error.code === MediaError.MEDIA_ERR_ABORTED) return;
    // NETWORK errors are transient — the browser re-issues range requests automatically.
    // Showing error UI would destroy the <video> element and cause a full reload cycle.
    if (vid.error.code === MediaError.MEDIA_ERR_NETWORK) {
      console.warn("Transient network error (ignored):", vid.error.message);
      return;
    }
    // HLS.js handles its own error recovery
    if (hlsRef.current) return;
    console.warn("Video playback error:", vid.error.code, vid.error.message);
    setError(
      `Playback error (code ${vid.error.code}). Try refreshing the page.`
    );
  }, []);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const vid = videoRef.current;
      if (!vid || !isFinite(vid.duration) || vid.duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      vid.currentTime = pct * vid.duration;
    },
    []
  );

  const handlePlayPause = useCallback(() => {
    const vid = videoRef.current;
    if (vid) vid.paused ? vid.play() : vid.pause();
  }, []);

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    }
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const safeDuration =
    isFinite(duration) && duration > 0 ? duration : 0;
  const progressPercent =
    safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;
  const bufferedPercent =
    safeDuration > 0 ? (buffered / safeDuration) * 100 : 0;

  // Error state — show retry UI instead of broken player
  if (error) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-rose-400 text-xl font-bold">Playback Error</p>
          <p className="text-zinc-400 text-sm max-w-md">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setError(null);
                const vid = videoRef.current;
                if (vid) {
                  vid.load();
                  vid.play().catch(() => {});
                }
              }}
              className="rounded-lg bg-rose-500 px-6 py-2 text-white hover:bg-rose-400"
            >
              Retry
            </button>
            <Link
              to={`/anime/${animeId}`}
              className="rounded-lg bg-zinc-800 px-6 py-2 text-white hover:bg-zinc-700"
            >
              Go Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input")) return;
        handlePlayPause();
      }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        preload="auto"
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onProgress={handleBufferProgress}
        onEnded={handleEnded}
        onError={handleError}
        playsInline
      />

      {activeSkip && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-end px-4 sm:bottom-24 sm:px-6">
          <button
            type="button"
            onClick={handleSkipClick}
            className="pointer-events-auto cursor-pointer rounded-lg border border-white/15 bg-black/35 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-[background-color,border-color,transform] hover:border-rose-300/30 hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.98] sm:px-5 sm:text-base"
          >
            Skip {getSkipLabel(activeSkip)}
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to={`/anime/${animeId}`}
              className="text-white hover:text-rose-400 transition-colors p-1"
            >
              <ArrowLeft size={22} />
            </Link>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-sm sm:text-lg truncate">{title}</h2>
              <p className="text-zinc-400 text-xs sm:text-sm">Episode {episodeNumber}</p>
            </div>
          </div>
        </div>

        {/* Center play button */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => videoRef.current?.play()}
              className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full bg-rose-500/90 transition-colors hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <Play size={36} className="text-white ml-1" fill="white" />
            </button>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-3 sm:px-4 pb-3 sm:pb-4 pt-16">
          {/* Progress bar */}
          <div
            className="relative w-full h-2 sm:h-1.5 bg-zinc-700 rounded-full cursor-pointer group/progress mb-2 sm:mb-3 sm:hover:h-2.5 transition-all touch-none"
            onClick={handleSeek}
            onTouchEnd={(e) => {
              const touch = e.changedTouches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
              const vid = videoRef.current;
              if (vid && isFinite(vid.duration) && vid.duration > 0) {
                vid.currentTime = pct * vid.duration;
              }
            }}
          >
            {/* Buffered */}
            <div
              className="absolute h-full bg-zinc-500 rounded-full transition-[width] duration-300"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Progress */}
            <div
              className="absolute h-full bg-rose-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-rose-500 shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `${progressPercent}%`, marginLeft: "-7px" }}
            />

            {/* Skip time markers */}
            {skipTimes.map((st, i) => {
              const startPct =
                safeDuration > 0
                  ? (st.startTime / safeDuration) * 100
                  : 0;
              const endPct =
                safeDuration > 0
                  ? (st.endTime / safeDuration) * 100
                  : 0;
              return (
                <>
                  <div
                    key={`${i}-start`}
                    className="absolute top-1/2 h-[80%] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400/45"
                    style={{ left: `${startPct}%` }}
                  />
                  <div
                    key={`${i}-end`}
                    className="absolute top-1/2 h-[80%] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400/25"
                    style={{ left: `${endPct}%` }}
                  />
                </>
              );
            })}
          </div>

          {/* Button row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handlePlayPause}
                className="cursor-pointer rounded-full p-2 text-white transition-colors hover:bg-white/8 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {playing ? <Pause size={22} /> : <Play size={22} />}
              </button>

              {onPrevEpisode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrevEpisode();
                  }}
                  className="cursor-pointer rounded-full p-2 text-white transition-colors hover:bg-white/8 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <SkipBack size={18} />
                </button>
              )}
              {onNextEpisode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNextEpisode();
                  }}
                  className="cursor-pointer rounded-full p-2 text-white transition-colors hover:bg-white/8 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <SkipForward size={18} />
                </button>
              )}

              {/* Volume — hidden on mobile (system controls volume) */}
              <button
                onClick={() => setMuted(!muted)}
                className="hidden sm:block text-white hover:text-rose-400 transition-colors"
              >
                {muted || volume === 0 ? (
                  <VolumeX size={20} />
                ) : (
                  <Volume2 size={20} />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setMuted(false);
                }}
                className="hidden sm:block w-20 accent-rose-500"
              />

              <span className="text-white text-xs sm:text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(safeDuration)}
              </span>
            </div>

            <div className="flex items-center gap-3 relative">
              {/* Settings */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                }}
                className="text-white hover:text-rose-400 transition-colors"
              >
                <Settings size={20} />
              </button>

              {showSettings && (
                <div
                  className="absolute bottom-full right-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-w-[180px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs text-zinc-400 mb-2">Playback Speed</p>
                  <div className="grid grid-cols-4 gap-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setPlaybackRate(rate);
                          setShowSettings(false);
                        }}
                        className={`text-xs rounded px-2 py-1 transition-colors ${
                          playbackRate === rate
                            ? "bg-rose-500 text-white"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-rose-400 transition-colors"
              >
                {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(VideoPlayer, (prev, next) => {
  return (
    prev.url === next.url &&
    prev.title === next.title &&
    prev.initialTime === next.initialTime &&
    prev.episodeNumber === next.episodeNumber &&
    prev.animeId === next.animeId &&
    prev.skipTimes === next.skipTimes &&
    prev.isHls === next.isHls
  );
});
