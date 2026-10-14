import { Capacitor } from '@capacitor/core';
import { DownloadOptions, DownloadProgress, SystemBinariesStatus, DownloadItem, Category } from './types/index';

// Detect if running inside native Android/iOS Capacitor shell
export const isMobileNative = Capacitor.isNativePlatform();

// Helper to access native Capacitor plugin
const getNativeDownloader = () => {
  return (Capacitor as any).Plugins?.VortexDownloader;
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
        if (nativePlugin) {
          await nativePlugin.startDownload({
            url: options.url,
            format,
            id
          });
        }

        // Add to mobile library
        const current = getMobileLibrary();
        const newItem: DownloadItem = {
          id,
          url: options.url,
          title: options.url.split('/').pop() || 'Archivo Vortex',
          filepath: '/storage/emulated/0/Download/Vortex',
          filename: 'Vortex_Download_' + id,
          filesize: 0,
          duration: 0,
          resolution: options.videoResolution || '1080p',
          format: format,
          status: 'completed',
          category_id: options.categoryId,
          thumbnail_url: '',
          download_date: new Date().toISOString()
        };
        saveMobileLibrary([newItem, ...current]);
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
            callback({
              id: data.id,
              status: data.status,
              percent: data.percent,
              speed: '',
              totalSize: '',
              eta: data.eta || '',
              downloadedSize: ''
            });
          });
          return () => {
            listener.then((sub: any) => sub?.remove?.());
          };
        }
        return () => {};
      },

      onLibraryUpdated: (_callback: () => void) => {
        return () => {};
      }
    };
  }

  // 3. Fallback mock for browser preview
  return null;
};
