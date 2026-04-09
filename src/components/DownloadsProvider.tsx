import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, getApiUrl } from "@/lib/api";
import type { DeviceDownloadItem } from "@/lib/types";

const DB_NAME = "motchi-device-downloads";
const DB_VERSION = 1;
const META_STORE = "download-meta";
const FILE_STORE = "download-files";

type DownloadRequest = {
  animeId: string;
  animeName: string;
  animeImage?: string;
  episodeNumber: string;
  episodeTitle?: string;
  episodeImage?: string;
  episodeDescription?: string;
};

type DownloadsContextValue = {
  downloads: DeviceDownloadItem[];
  isReady: boolean;
  startDownload: (request: DownloadRequest) => Promise<DeviceDownloadItem | null>;
  deleteDownload: (id: string) => Promise<void>;
  openDownload: (id: string) => Promise<void>;
  getEpisodeDownload: (
    animeId: string,
    episodeNumber: string
  ) => DeviceDownloadItem | undefined;
};

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

let openDbPromise: Promise<IDBDatabase> | null = null;

function sortDownloads(items: DeviceDownloadItem[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function requestToPromise<T = undefined>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

async function openDb() {
  if (!openDbPromise) {
    openDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          db.createObjectStore(FILE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open downloads database"));
    });
  }

  return openDbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>
) {
  const db = await openDb();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  const result = await callback(store);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });

  return result;
}

function listDownloadMeta() {
  return withStore(META_STORE, "readonly", async (store) => {
    const items = await requestToPromise(store.getAll() as IDBRequest<DeviceDownloadItem[]>);
    return sortDownloads(items);
  });
}

function saveDownloadMeta(item: DeviceDownloadItem) {
  return withStore(META_STORE, "readwrite", async (store) => {
    await requestToPromise(store.put(item));
  });
}

function deleteDownloadMeta(id: string) {
  return withStore(META_STORE, "readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });
}

function saveDownloadFile(id: string, blob: Blob) {
  return withStore(FILE_STORE, "readwrite", async (store) => {
    await requestToPromise(store.put(blob, id));
  });
}

function getDownloadFile(id: string) {
  return withStore(FILE_STORE, "readonly", async (store) => {
    return requestToPromise(store.get(id) as IDBRequest<Blob | undefined>);
  });
}

function deleteDownloadFile(id: string) {
  return withStore(FILE_STORE, "readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });
}

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState<DeviceDownloadItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const downloadsRef = useRef<DeviceDownloadItem[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const deletingIdsRef = useRef(new Set<string>());
  const objectUrlsRef = useRef(new Map<string, string>());

  const updateDownloads = useCallback((updater: (items: DeviceDownloadItem[]) => DeviceDownloadItem[]) => {
    setDownloads((current) => {
      const next = sortDownloads(updater(current));
      downloadsRef.current = next;
      return next;
    });
  }, []);

  const upsertDownload = useCallback(
    async (item: DeviceDownloadItem, persist = true) => {
      updateDownloads((current) => [
        item,
        ...current.filter((entry) => entry.id !== item.id),
      ]);

      if (persist) {
        await saveDownloadMeta(item);
      }

      return item;
    },
    [updateDownloads]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const existing = await listDownloadMeta();
      const recovered = await Promise.all(
        existing.map(async (item) => {
          if (item.status === "downloading" || item.status === "pending") {
            const recoveredItem: DeviceDownloadItem = {
              ...item,
              status: "error",
              progress: 0,
              errorMessage: "Download was interrupted. Retry to continue.",
            };
            await saveDownloadMeta(recoveredItem);
            return recoveredItem;
          }

          return item;
        })
      );

      if (!active) {
        return;
      }

      downloadsRef.current = sortDownloads(recovered);
      setDownloads(downloadsRef.current);
      setIsReady(true);
    })();

    return () => {
      active = false;
      for (const controller of controllersRef.current.values()) {
        controller.abort();
      }
      for (const objectUrl of objectUrlsRef.current.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      controllersRef.current.clear();
      objectUrlsRef.current.clear();
    };
  }, []);

  const deleteDownload = useCallback(async (id: string) => {
    const existing = downloadsRef.current.find((item) => item.id === id);
    if (!existing) {
      return;
    }

    deletingIdsRef.current.add(id);
    const deletingItem: DeviceDownloadItem = { ...existing, status: "deleting" };
    updateDownloads((current) => [
      deletingItem,
      ...current.filter((item) => item.id !== id),
    ]);

    const controller = controllersRef.current.get(id);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(id);
    }

    const objectUrl = objectUrlsRef.current.get(id);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrlsRef.current.delete(id);
    }

    await Promise.allSettled([deleteDownloadFile(id), deleteDownloadMeta(id)]);
    updateDownloads((current) => current.filter((item) => item.id !== id));
    deletingIdsRef.current.delete(id);
  }, [updateDownloads]);

  const openDownload = useCallback(async (id: string) => {
    const item = downloadsRef.current.find((download) => download.id === id);
    if (!item || item.status !== "complete") {
      return;
    }

    const blob = await getDownloadFile(id);
    if (!blob) {
      await upsertDownload(
        {
          ...item,
          status: "error",
          progress: 0,
          errorMessage: "Download file is missing from browser storage.",
        },
        true
      );
      return;
    }

    let objectUrl = objectUrlsRef.current.get(id);
    if (!objectUrl) {
      objectUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.set(id, objectUrl);
    }

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }, [upsertDownload]);

  const startDownload = useCallback(async (request: DownloadRequest) => {
    const existing = downloadsRef.current.find(
      (item) =>
        item.animeId === request.animeId &&
        item.episodeNumber === request.episodeNumber
    );

    if (existing?.status === "downloading" || existing?.status === "pending") {
      return existing;
    }

    if (existing?.status === "complete") {
      return existing;
    }

    const id = existing?.id ?? crypto.randomUUID();
    if (existing) {
      await deleteDownloadFile(id).catch(() => undefined);
    }

    const nextDownload: DeviceDownloadItem = {
      id,
      animeId: request.animeId,
      animeName: request.animeName,
      animeImage: request.animeImage,
      episodeNumber: request.episodeNumber,
      episodeTitle: request.episodeTitle,
      episodeImage: request.episodeImage,
      episodeDescription: request.episodeDescription,
      status: "downloading",
      progress: 0,
      fileSize: null,
      mimeType: null,
      errorMessage: null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    await upsertDownload(nextDownload, true);

    const controller = new AbortController();
    controllersRef.current.set(id, controller);

    try {
      const streamLink = await api.getPlayUrl(
        request.animeId,
        request.episodeNumber,
        "1080p"
      );

      if (streamLink.type !== "mp4") {
        throw new Error("This episode does not expose a direct MP4 download.");
      }

      const proxiedUrl = getApiUrl(
        `/proxy/stream?url=${encodeURIComponent(streamLink.url)}${
          streamLink.referer
            ? `&referer=${encodeURIComponent(streamLink.referer)}`
            : ""
        }`
      );

      const response = await fetch(proxiedUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Download failed with HTTP ${response.status}`);
      }
      if (!response.body) {
        throw new Error("Download stream was empty.");
      }

      const reader = response.body.getReader();
      const totalSize = Number(response.headers.get("content-length") ?? 0);
      const chunks: BlobPart[] = [];
      let downloadedBytes = 0;
      let lastRenderedProgress = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        chunks.push(new Uint8Array(value));
        downloadedBytes += value.byteLength;

        if (totalSize > 0) {
          const progress = Math.min(
            100,
            Math.round((downloadedBytes / totalSize) * 100)
          );
          if (progress >= lastRenderedProgress + 5 || progress === 100) {
            lastRenderedProgress = progress;
            void upsertDownload(
              {
                ...nextDownload,
                status: "downloading",
                progress,
                fileSize: totalSize,
              },
              false
            );
          }
        }
      }

      const blob = new Blob(chunks, {
        type: response.headers.get("content-type") ?? "video/mp4",
      });
      await saveDownloadFile(id, blob);

      return upsertDownload(
        {
          ...nextDownload,
          status: "complete",
          progress: 100,
          fileSize: blob.size,
          mimeType: blob.type,
          errorMessage: null,
        },
        true
      );
    } catch (error) {
      if (controller.signal.aborted && deletingIdsRef.current.has(id)) {
        return null;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Failed to download episode.";

      return upsertDownload(
        {
          ...nextDownload,
          status: "error",
          progress: 0,
          errorMessage,
        },
        true
      );
    } finally {
      controllersRef.current.delete(id);
    }
  }, [upsertDownload]);

  const getEpisodeDownload = useCallback(
    (animeId: string, episodeNumber: string) =>
      downloadsRef.current.find(
        (item) => item.animeId === animeId && item.episodeNumber === episodeNumber
      ),
    []
  );

  const value = useMemo<DownloadsContextValue>(
    () => ({
      downloads,
      isReady,
      startDownload,
      deleteDownload,
      openDownload,
      getEpisodeDownload,
    }),
    [deleteDownload, downloads, getEpisodeDownload, isReady, openDownload, startDownload]
  );

  return (
    <DownloadsContext.Provider value={value}>
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads() {
  const context = useContext(DownloadsContext);
  if (!context) {
    throw new Error("useDownloads must be used within DownloadsProvider");
  }

  return context;
}