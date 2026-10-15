import { Capacitor } from '@capacitor/core';
import { DownloadOptions, DownloadProgress, SystemBinariesStatus, DownloadItem, Category } from './types/index';

// Detect if running inside native Android/iOS Capacitor shell
export const isMobileNative = Capacitor.isNativePlatform();

// Helper to access native Capacitor plugin
const getNativeDownloader = () => {
  return (Capacitor as any).Plugins?.VortexDownloader;
};

// Metadata cache for instant UI rendering
const metadataCache = new Map<string, any>();

// Library update event listeners for mobile reactivity
const libraryListeners = new Set<() => void>();
const notifyLibraryUpdated = () => {
  libraryListeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.error('Error invoking library listener:', e);
    }
  });
};

// Fallback in-memory/localStorage for mobile library
const getMobileLibrary = (): DownloadItem[] => {
  try {
    const raw = localStorage.getItem('vortex_mobile_library');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveMobileLibrary = (items: DownloadItem[]) => {
  try {
    localStorage.setItem('vortex_mobile_library', JSON.stringify(items));
    notifyLibraryUpdated();
  } catch (e) {
    console.error('Error saving mobile library:', e);
  }
};

export const getVortexApi = () => {
  // 1. If running in Electron desktop
  if (typeof window !== 'undefined' && ((window as any).vortexAPI || (window as any).smasherAPI)) {
    return (window as any).vortexAPI || (window as any).smasherAPI;
  }

  // 2. If running inside Native Android (Capacitor)
  if (isMobileNative) {
    const nativePlugin = getNativeDownloader();

    return {
      getBinariesStatus: async (): Promise<SystemBinariesStatus> => {
        try {
          if (nativePlugin) {
            const res = await nativePlugin.getStatus();
            return {
              ready: true,
              ytdlp: { found: true, path: 'arm64', version: res?.version || '2026.x (ARM64)' },
              ffmpeg: { found: true, path: 'libffmpeg.so', version: 'FFmpegKit 6.x' },
              deno: { found: true, path: 'embedded', version: 'Embedded' }
            };
          }
        } catch (e) {
          console.warn('Native status check failed:', e);
        }
        return {
          ready: true,
          ytdlp: { found: true, path: 'arm64', version: 'ARM64 Ready' },
          ffmpeg: { found: true, path: 'libffmpeg.so', version: 'Native Ready' },
          deno: { found: true, path: 'embedded', version: 'Native' }
        };
      },

      installBinaries: async () => {
        if (nativePlugin) {
          return await nativePlugin.initEngine();
        }
        return { success: true };
      },

      onBootstrapProgress: () => () => {},

      fetchMetadata: async (url: string) => {
        if (!url || !url.startsWith('http')) return null;

        // 1. YouTube instant oEmbed (<100ms)
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const res = await fetch(oembedUrl);
            if (res.ok) {
              const data = await res.json();
              const meta = {
                id: 'meta_' + Date.now(),
                title: data.title || 'Video de YouTube',
                url,
                duration: 0,
                thumbnail: data.thumbnail_url || '',
                uploader: data.author_name || 'YouTube',
                formats: []
              };
              metadataCache.set(url, meta);
              return meta;
            }
          } catch (e) {
            console.warn('oEmbed lookup failed, falling back to plugin:', e);
          }
        }

        // 2. Native plugin extraction for other platforms or fallback
        if (nativePlugin?.fetchMetadata) {
          try {
            const res = await nativePlugin.fetchMetadata({ url });
            if (res?.title) {
              const meta = {
                id: 'meta_' + Date.now(),
                title: res.title,
                url,
                duration: res.duration || 0,
                thumbnail: res.thumbnail || '',
                uploader: res.uploader || 'Vortex',
                formats: []
              };
              metadataCache.set(url, meta);
              return meta;
            }
          } catch (e) {
            console.warn('Native metadata extraction failed:', e);
          }
        }

        return {
          id: 'meta_' + Date.now(),
          title: 'Descarga Multimedia',
          url,
          duration: 0,
          thumbnail: '',
          uploader: 'Vortex Mobile',
          formats: []
        };
      },

      startDownload: async (options: DownloadOptions) => {
        const id = 'dl_' + Date.now();
        const format = options.mediaType === 'audio' ? 'audio_mp3' : (options.formatPreset || 'video_best');
        const cachedMeta = metadataCache.get(options.url);

        // Add to mobile library with downloading status
        const current = getMobileLibrary();
        const newItem: DownloadItem = {
          id,
          url: options.url,
          title: cachedMeta?.title || options.url.split('/').pop() || 'Archivo Vortex',
          filepath: '',
          filename: 'Vortex_Download_' + id,
          filesize: 0,
          duration: cachedMeta?.duration || 0,
          resolution: options.videoResolution || '1080p',
          format: format,
          status: 'downloading',
          category_id: options.categoryId,
          thumbnail_url: cachedMeta?.thumbnail || '',
          download_date: new Date().toISOString()
        };
        saveMobileLibrary([newItem, ...current]);

        if (nativePlugin) {
          try {
            await nativePlugin.startDownload({
              url: options.url,
              format,
              id
            });
          } catch (e: any) {
            console.error('Plugin startDownload error:', e);
          }
        }

        return { success: true, id };
      },

      cancelDownload: async (_id: string) => {
        return { success: true };
      },

      getLibrary: async () => {
        return getMobileLibrary();
      },

      deleteItem: async (id: string) => {
        const items = getMobileLibrary().filter(item => item.id !== id);
        saveMobileLibrary(items);
        return true;
      },

      getCategories: async (): Promise<Category[]> => {
        return [
          { id: 1, name: 'Música', color: '#00F5FF' },
          { id: 2, name: 'Videos', color: '#BD00FF' },
          { id: 3, name: 'Podcasts', color: '#00FF66' }
        ];
      },

      addCategory: async () => true,
      getStats: async () => ({ totalDownloads: getMobileLibrary().length, totalSize: 0, successCount: getMobileLibrary().length }),
      openFile: async () => true,
      openFolder: async () => true,
      selectFolder: async () => '/storage/emulated/0/Download/Vortex',

      getQrServerStatus: async () => ({ isRunning: false, port: 8080, url: '' }),
      startQrServer: async () => ({ success: false }),
      stopQrServer: async () => ({ success: true }),
      configureFirewallAndNetwork: async () => ({ success: true }),

      reconcileLibrary: async () => ({ restored: 0, total: 0 }),
      refetchMetadata: async () => true,
      backupDatabase: async () => true,
      restoreDatabase: async () => true,
      getPointsOfInterest: async () => [],
      getSubtitles: async () => [],

      onProgress: (callback: (progress: DownloadProgress) => void) => {
        if (nativePlugin) {
          const listener = nativePlugin.addListener('onProgress', (data: any) => {
            if (data.status === 'completed' || data.status === 'error') {
              const current = getMobileLibrary();
              const updated = current.map(item => {
                if (item.id === data.id) {
                  return {
                    ...item,
                    status: data.status,
                    filepath: data.path || item.filepath,
                    filename: data.filename || item.filename,
                    filesize: data.filesize || item.filesize,
                    title: (data.title && data.title.trim().length > 0) ? data.title : item.title
                  };
                }
                return item;
              });
              saveMobileLibrary(updated);
            }

            callback({
              id: data.id,
              status: data.status,
              percent: data.percent,
              speed: data.speed || '',
              totalSize: data.totalSize || '',
              eta: data.eta || '',
              downloadedSize: '',
              error: data.error
            });
          });
          return () => {
            listener.then((sub: any) => sub?.remove?.());
          };
        }
        return () => {};
      },

      onLibraryUpdated: (callback: () => void) => {
        libraryListeners.add(callback);
        return () => {
          libraryListeners.delete(callback);
        };
      }
    };
  }

  // 3. Fallback mock for browser preview
  return null;
};
