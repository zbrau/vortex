import React, { useEffect, useState, useCallback } from 'react';
import { MantineProvider, Container, Box } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { buildCustomTheme, themes } from './theme/themes';
import { ThemePreset, DownloadItem, DownloadOptions, DownloadProgress, Category, SystemBinariesStatus } from './types';
import { Navbar } from './components/Navbar';
import { DownloadBar } from './components/DownloadBar';
import { ActiveQueue } from './components/ActiveQueue';
import { LibraryView } from './components/LibraryView';
import { SettingsModal } from './components/SettingsModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { QrShareModal } from './components/QrShareModal';
import { MaintenanceModal } from './components/MaintenanceModal';
import { MiniPlayerBar } from './components/MiniPlayerBar';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { FirstRunSetupModal } from './components/FirstRunSetupModal';
import { useLanguage } from './i18n/LanguageContext';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { getVortexApi } from './api';

const getApi = () => getVortexApi();

export const App: React.FC = () => {
  const { t } = useLanguage();
  const [currentTheme, setCurrentTheme] = useState<ThemePreset>(() => {
    return (localStorage.getItem('vortex_theme') as ThemePreset) ||
           (localStorage.getItem('smasher_theme') as ThemePreset) ||
           'synthwave';
  });
  const [customAccent, setCustomAccent] = useState<string>(() => {
    return localStorage.getItem('vortex_accent') ||
           localStorage.getItem('smasher_accent') ||
           '';
  });

  const [activeTab, setActiveTab] = useState('download');
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [qrShareOpened, setQrShareOpened] = useState(false);
  const [maintenanceOpened, setMaintenanceOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);
  const [setupOpened, setSetupOpened] = useState(false);

  // Active playing item for persistent mini dock and full video modal
  const [miniPlayerItem, setMiniPlayerItem] = useState<DownloadItem | null>(null);
  const [activeItemForPlayer, setActiveItemForPlayer] = useState<DownloadItem | null>(null);

  const [binaryStatus, setBinaryStatus] = useState<SystemBinariesStatus | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [libraryItems, setLibraryItems] = useState<DownloadItem[]>([]);
  const [progressList, setProgressList] = useState<DownloadProgress[]>([]);

  const handleSelectTheme = (t: ThemePreset) => {
    setCurrentTheme(t);
    localStorage.setItem('vortex_theme', t);
    localStorage.setItem('smasher_theme', t);
  };

  const handleSelectAccent = (color: string) => {
    setCustomAccent(color);
    localStorage.setItem('vortex_accent', color);
    localStorage.setItem('smasher_accent', color);
  };

  const refreshLibrary = useCallback(async () => {
    const api = getApi();
    if (api) {
      const items = await api.getLibrary();
      setLibraryItems(items);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    const api = getApi();
    if (api) {
      const cats = await api.getCategories();
      setCategories(cats);
    }
  }, []);

  const refreshBinaryStatus = useCallback(async () => {
    const api = getApi();
    if (api) {
      const status: SystemBinariesStatus = await api.getBinariesStatus();
      setBinaryStatus(status);
      return status;
    }
    return null;
  }, []);

  useEffect(() => {
    // Global shortcut Ctrl+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpened(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const api = getApi();
    if (api) {
      refreshBinaryStatus().then(status => {
        if (status && (!status.ready || status.needsBootstrap)) {
          setSetupOpened(true);
        }
      });
      refreshLibrary();
      refreshCategories();

      const unsubscribe = api.onProgress((data: DownloadProgress) => {
        setProgressList(prev => {
          const index = prev.findIndex(p => p.id === data.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = data;
            return next;
          }
          return [...prev, data];
        });

        if (data.status === 'completed') {
          notifications.show({
            title: t('notif.downloadFinished'),
            message: t('notif.downloadFinishedMsg'),
            color: 'teal'
          });
          refreshLibrary();
        } else if (data.status === 'error') {
          notifications.show({
            title: t('notif.downloadError'),
            message: data.error || 'Download error',
            color: 'red'
          });
          refreshLibrary();
        }
      });

      let libUpdateTimer: any = null;
      const unsubLib = api.onLibraryUpdated ? api.onLibraryUpdated(() => {
        if (libUpdateTimer) clearTimeout(libUpdateTimer);
        libUpdateTimer = setTimeout(() => {
          refreshLibrary();
        }, 200);
      }) : null;

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (libUpdateTimer) clearTimeout(libUpdateTimer);
        if (unsubscribe) unsubscribe();
        if (unsubLib) unsubLib();
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshBinaryStatus, refreshLibrary, refreshCategories]);

  const handleStartDownload = async (options: DownloadOptions) => {
    const api = getApi();
    if (api) {
      await api.startDownload(options);
      notifications.show({
        title: t('notif.downloadStarted'),
        message: t('notif.downloadStartedMsg'),
        color: 'pink'
      });
      refreshLibrary();
    }
  };

  const handleCancelDownload = async (id: string) => {
    const api = getApi();
    if (api) {
      await api.cancelDownload(id);
      refreshLibrary();
    }
  };

  const handleOpenFile = async (filepath: string) => {
    const api = getApi();
    if (api) await api.openFile(filepath);
  };

  const handleOpenFolder = async (filepath: string) => {
    const api = getApi();
    if (api) await api.openFolder(filepath);
  };

  const handleDeleteItem = async (id: string) => {
    const api = getApi();
    if (api) {
      await api.deleteItem(id);
      if (miniPlayerItem?.id === id) setMiniPlayerItem(null);
      if (activeItemForPlayer?.id === id) setActiveItemForPlayer(null);
      refreshLibrary();
    }
  };

  const handlePlayItem = (item: DownloadItem) => {
    // Start playback immediately in the bottom mini player dock
    setMiniPlayerItem(item);
  };

  const handleExpandToVideo = (item: DownloadItem, _currentTime: number) => {
    setActiveItemForPlayer(item);
  };

  const handleRefetchMeta = async (item: DownloadItem) => {
    notifications.show({
      title: 'Actualizando Metadatos',
      message: 'Consultando capítulos, carátulas y subtítulos...',
      color: 'blue'
    });
    const api = getApi();
    if (api) {
      const res = await api.refetchMetadata(item.id, item.url);
      if (res.success) {
        notifications.show({
          title: 'Metadatos Actualizados',
          message: `Capítulos indexados: ${res.meta.chapters?.length || 0}`,
          color: 'teal'
        });
        refreshLibrary();
      } else {
        notifications.show({
          title: 'Error actualizando',
          message: res.error,
          color: 'red'
        });
      }
    }
  };

  const handleAddCategory = async (name: string, color: string) => {
    const api = getApi();
    if (api) {
      await api.addCategory(name, color);
      refreshCategories();
    }
  };

  const activeThemeConfig = buildCustomTheme(currentTheme, customAccent);
  const effectiveAccent = customAccent || activeThemeConfig.accent;

  return (
    <MantineProvider theme={activeThemeConfig.theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <Box
        style={{
          background: `radial-gradient(ellipse 70% 35% at 50% -5%, ${effectiveAccent}18, transparent 70%), ${activeThemeConfig.bg}`,
          minHeight: '100vh',
          color: '#fff',
          paddingBottom: miniPlayerItem ? 85 : 0
        }}
      >
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          binaryStatus={binaryStatus}
          onOpenSettings={() => setSettingsOpened(true)}
          onOpenQrShare={() => setQrShareOpened(true)}
          onOpenMaintenance={() => setMaintenanceOpened(true)}
          onOpenCommandPalette={() => setCommandPaletteOpened(true)}
          onOpenSetup={() => setSetupOpened(true)}
          itemCount={libraryItems.length}
        />

        <Container size="xl" py="lg">
          {activeTab === 'download' && (
            <>
              <DownloadBar
                onStartDownload={handleStartDownload}
                categories={categories}
                isDownloading={progressList.some(p => p.status === 'downloading')}
              />
              <ActiveQueue
                progressList={progressList}
                onCancel={handleCancelDownload}
              />
            </>
          )}

          {activeTab === 'library' && (
            <LibraryView
              items={libraryItems}
              categories={categories}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onDeleteItem={handleDeleteItem}
              onPlayItem={handlePlayItem}
              onRefetchMeta={handleRefetchMeta}
            />
          )}
        </Container>

        {/* Floating Mini Player Dock */}
        <MiniPlayerBar
          item={miniPlayerItem}
          onClose={() => setMiniPlayerItem(null)}
          onExpandToVideo={handleExpandToVideo}
          accentColor={effectiveAccent}
        />

        {/* Global Command Palette (Ctrl+K) */}
        <CommandPaletteModal
          opened={commandPaletteOpened}
          onClose={() => setCommandPaletteOpened(false)}
          libraryItems={libraryItems}
          onPlayItem={handlePlayItem}
          onOpenFolder={handleOpenFolder}
          onNavigateTab={tab => setActiveTab(tab)}
          onSelectTheme={handleSelectTheme}
          onOpenQr={() => setQrShareOpened(true)}
          onOpenMaintenance={() => setMaintenanceOpened(true)}
        />

        <SettingsModal
          opened={settingsOpened}
          onClose={() => setSettingsOpened(false)}
          currentTheme={currentTheme}
          onSelectTheme={handleSelectTheme}
          customAccent={customAccent}
          onSelectAccent={handleSelectAccent}
          binaryStatus={binaryStatus}
          categories={categories}
          onAddCategory={handleAddCategory}
          onOpenSetup={() => setSetupOpened(true)}
        />

        <QrShareModal
          opened={qrShareOpened}
          onClose={() => setQrShareOpened(false)}
        />

        <MaintenanceModal
          opened={maintenanceOpened}
          onClose={() => setMaintenanceOpened(false)}
          onRefreshLibrary={refreshLibrary}
        />

        <VideoPlayerModal
          item={activeItemForPlayer}
          onClose={() => setActiveItemForPlayer(null)}
        />

        {/* Autonomous First-Run Bootstrapper Modal */}
        <FirstRunSetupModal
          opened={setupOpened}
          onClose={() => setSetupOpened(false)}
          binaryStatus={binaryStatus}
          onSuccess={async () => {
            const s = await refreshBinaryStatus();
            if (s?.ready) {
              notifications.show({
                title: '¡Vortex Listo!',
                message: 'Los motores multimedia se han instalado y verificado correctamente.',
                color: 'teal'
              });
            }
          }}
          accentColor={effectiveAccent}
        />
      </Box>
    </MantineProvider>
  );
};
