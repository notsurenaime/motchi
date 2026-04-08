import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { api, getApiUrl } from "@/lib/api";
import VideoPlayer from "@/components/VideoPlayer";

interface WatchProps {
  profileId: number;
}

export default function Watch({ profileId }: WatchProps) {
  const { id, episode } = useParams<{ id: string; episode: string }>();
  const navigate = useNavigate();

  // Fetch anime details for episode list & navigation
  const { data: anime } = useQuery({
    queryKey: ["anime-detail", id],
    queryFn: () => api.getAnimeDetail(id!),
    enabled: !!id,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch stream URL — staleTime: Infinity prevents refetch that reloads video
  const { data: streamLink, isLoading: streamLoading } = useQuery({
    queryKey: ["stream", id, episode],
    queryFn: () => api.getPlayUrl(id!, episode!),
    enabled: !!id && !!episode,
    retry: 2,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch skip times
  const { data: skipData } = useQuery({
    queryKey: ["skip-times", anime?.name, episode],
    queryFn: () => api.getSkipTimes(anime!.name, episode!),
    enabled: !!anime?.name && !!episode,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Get existing watch progress for resume
  const { data: history } = useQuery({
    queryKey: ["history", profileId],
    queryFn: () => api.getHistory(profileId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const existingProgress = history?.find(
    (h) => h.animeId === id && h.episodeNumber === episode
  );

  // Lock resume time so it's only captured once (prevents VideoPlayer re-renders)
  const [resumeTime, setResumeTime] = useState(0);
  const resumeTimeLocked = useRef(false);
  useEffect(() => {
    if (!resumeTimeLocked.current && existingProgress?.progress && existingProgress.progress > 0) {
      setResumeTime(existingProgress.progress);
      resumeTimeLocked.current = true;
    }
  }, [existingProgress?.progress]);

  // Progress save — fire-and-forget fetch, no React state involved at all.
  // This avoids useMutation re-renders that were cascading into component remounts.
  // Initialize to Date.now() so the first save is delayed by 30s (not immediate on mount).
  const lastSavedRef = useRef(Date.now());
  const animeRef = useRef(anime);
  const latestPlaybackRef = useRef<{ current: number; duration: number } | null>(
    null
  );
  const lastPersistedSignatureRef = useRef<string | null>(null);
  const lastPersistedAtRef = useRef(0);
  const pendingProgressRef = useRef<Parameters<typeof api.updateProgress>[0] | null>(
    null
  );
  const savingProgressRef = useRef(false);
  animeRef.current = anime;

  const buildProgressPayload = useCallback(
    (current: number, duration: number) => {
      if (!id || !episode || current <= 5 || duration <= 0) {
        return null;
      }

      const currentAnime = animeRef.current;
      if (!currentAnime?.name) {
        return null;
      }

      return {
        profileId,
        animeId: id,
        animeName: currentAnime.name,
        animeImage: currentAnime.thumbnail,
        episodeNumber: episode,
        progress: current,
        duration,
      };
    },
    [episode, id, profileId]
  );

  const makeProgressSignature = useCallback(
    (payload: Parameters<typeof api.updateProgress>[0]) =>
      [
        payload.profileId,
        payload.animeId,
        payload.episodeNumber,
        Math.floor(payload.progress),
        Math.floor(payload.duration),
      ].join(":"),
    []
  );

  const markProgressPersisted = useCallback((signature: string) => {
    lastPersistedSignatureRef.current = signature;
    lastPersistedAtRef.current = Date.now();
  }, []);

  const shouldSkipDuplicatePersist = useCallback((signature: string) => {
    return (
      lastPersistedSignatureRef.current === signature &&
      Date.now() - lastPersistedAtRef.current < 5_000
    );
  }, []);

  const flushProgress = useCallback(
    async () => {
      const snapshot = latestPlaybackRef.current;
      if (!snapshot) {
        return;
      }

      const payload = buildProgressPayload(snapshot.current, snapshot.duration);
      if (!payload) {
        return;
      }

      const signature = makeProgressSignature(payload);
      if (shouldSkipDuplicatePersist(signature)) {
        return;
      }

      pendingProgressRef.current = payload;
      if (savingProgressRef.current) {
        return;
      }

      savingProgressRef.current = true;
      try {
        while (pendingProgressRef.current) {
          const nextPayload: Parameters<typeof api.updateProgress>[0] =
            pendingProgressRef.current;
          const nextSignature = makeProgressSignature(nextPayload);
          if (shouldSkipDuplicatePersist(nextSignature)) {
            pendingProgressRef.current = null;
            continue;
          }
          await api.updateProgress(nextPayload);
          markProgressPersisted(nextSignature);
          if (pendingProgressRef.current === nextPayload) {
            pendingProgressRef.current = null;
          }
        }
      } catch (error) {
        console.error("Failed to save watch progress", error);
      } finally {
        savingProgressRef.current = false;
      }
    },
    [buildProgressPayload, makeProgressSignature, markProgressPersisted, shouldSkipDuplicatePersist]
  );

  const flushProgressOnPageHide = useCallback(() => {
    const snapshot = latestPlaybackRef.current;
    if (!snapshot) {
      return;
    }

    const payload = buildProgressPayload(snapshot.current, snapshot.duration);
    if (!payload) {
      return;
    }

    const signature = makeProgressSignature(payload);
    if (shouldSkipDuplicatePersist(signature)) {
      return;
    }

    try {
      const body = JSON.stringify(payload);
      const sent = navigator.sendBeacon(
        getApiUrl("/history"),
        new Blob([body], { type: "text/plain;charset=UTF-8" })
      );
      if (sent) {
        markProgressPersisted(signature);
      }
    } catch (error) {
      console.error("Failed to flush watch progress", error);
    }
  }, [buildProgressPayload, makeProgressSignature, markProgressPersisted, shouldSkipDuplicatePersist]);

  useEffect(() => {
    if (!existingProgress?.progress || !existingProgress.duration) {
      return;
    }

    const payload = buildProgressPayload(
      existingProgress.progress,
      existingProgress.duration
    );
    if (!payload) {
      return;
    }

    markProgressPersisted(makeProgressSignature(payload));
  }, [
    buildProgressPayload,
    existingProgress?.duration,
    existingProgress?.progress,
    makeProgressSignature,
    markProgressPersisted,
  ]);

  const handleProgress = useCallback(
    (current: number, duration: number) => {
      latestPlaybackRef.current = { current, duration };
      if (current > 5 && duration > 0) {
        const now = Date.now();
        if (now - lastSavedRef.current > 30_000) {
          lastSavedRef.current = now;
          void flushProgress();
        }
      }
    },
    [flushProgress]
  );

  useEffect(() => {
    const handlePageHide = () => {
      flushProgressOnPageHide();
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushProgressOnPageHide]);

  // Episode navigation
  const currentEpIdx = anime?.episodes.indexOf(episode!) ?? -1;
  const prevEp =
    currentEpIdx > 0 ? anime?.episodes[currentEpIdx - 1] : undefined;
  const nextEp =
    currentEpIdx >= 0 && currentEpIdx < (anime?.episodes.length ?? 0) - 1
      ? anime?.episodes[currentEpIdx + 1]
      : undefined;

  const goToEpisode = (ep: string) => navigate(`/watch/${id}/${ep}`);

  const isHls = streamLink?.type === "m3u8";

  // Memoize the video URL to prevent re-renders from changing it
  const videoUrl = useMemo(() => {
    if (!streamLink) return null;
    // HLS: pass original URL; HLS.js will proxy segment requests itself
    if (streamLink.type === "m3u8") return streamLink.url;
    // MP4: proxy when a referer header is needed
    return streamLink.referer
      ? getApiUrl(
          `/proxy/stream?url=${encodeURIComponent(streamLink.url)}&referer=${encodeURIComponent(streamLink.referer)}`
        )
      : streamLink.url;
  }, [streamLink?.url, streamLink?.referer, streamLink?.type]);

  if (streamLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading stream...</p>
          <p className="text-zinc-600 text-sm">
            Fetching episode {episode} of {anime?.name ?? "..."}
          </p>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-rose-400 text-xl font-bold">
            No streams available
          </p>
          <p className="text-zinc-400 text-sm">
            Could not find a valid stream for this episode.
          </p>
          <button
            onClick={() => navigate(`/anime/${id}`)}
            className="rounded-lg bg-zinc-800 px-6 py-2 text-white hover:bg-zinc-700"
          >
            Back to Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black">
      <VideoPlayer
        key={`${id}-${episode}`}
        url={videoUrl}
        title={anime?.name ?? ""}
        episodeNumber={episode!}
        animeId={id!}
        skipTimes={skipData?.skipTimes}
        onProgress={handleProgress}
        onNextEpisode={nextEp ? () => goToEpisode(nextEp) : undefined}
        onPrevEpisode={prevEp ? () => goToEpisode(prevEp) : undefined}
        initialTime={resumeTime}
        isHls={isHls}
        referer={streamLink?.referer}
      />
    </div>
  );
}
