import { app, BrowserWindow, ipcMain, shell, dialog, protocol, net, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { pathToFileURL } from 'url';
import { BinaryManager } from './binary-manager';
import { VortexDatabase } from './database';
import { VortexDownloader } from './downloader';
import { VortexQrServer } from './server';
import { DownloadOptions } from '../renderer/types';

const binaryManager = new BinaryManager();
const database = new VortexDatabase(binaryManager.getVortexDir());
const downloader = new VortexDownloader(binaryManager);

let mainWindow: BrowserWindow | null = null;

// Remove default Electron menu globally
Menu.setApplicationMenu(null);

app.name = 'Vortex';
app.setPath('userData', path.join(binaryManager.getVortexDir(), 'userData'));

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Register custom media schemes before app is ready (required for HTML5 video streaming)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vortex-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  },
  {
    scheme: 'smasher-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 920,
    minHeight: 620,
    title: 'Vortex',
    icon: path.join(__dirname, '../../build/icon.ico'),
    backgroundColor: '#0a0a0c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  downloader.setProgressCallback(progress => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vortex:onProgress', progress);
      mainWindow.webContents.send('smasher:onProgress', progress);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const prodHtml = path.join(__dirname, '../../dist/index.html');
    if (fs.existsSync(prodHtml)) {
      mainWindow.loadFile(prodHtml);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../../index.html'));
    }
  }
}

app.whenReady().then(async () => {
  await database.init();
  createWindow();

  // Media protocol handler helper
  const handleMediaProtocol = async (request: Request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      filePath = path.normalize(filePath);
      if (!fs.existsSync(filePath)) {
        console.error('Media file not found:', filePath);
        return new Response('File not found', { status: 404 });
      }
      // Delegate to internal HTTP streaming server for reliable HTTP 206 Range seeking
      const streamUrl = `http://127.0.0.1:6767/api/stream-file?path=${encodeURIComponent(filePath)}`;
      return await net.fetch(streamUrl, {
        headers: request.headers
      });
    } catch (e) {
      console.error('Error handling media protocol:', e);
      return new Response('File not found', { status: 404 });
    }
  };

  protocol.handle('vortex-media', handleMediaProtocol);
  protocol.handle('smasher-media', handleMediaProtocol);

  // Helper to register IPC handlers with both vortex: and smasher: prefixes
  const registerIpc = (channel: string, handler: (...args: any[]) => any) => {
    ipcMain.handle(`vortex:${channel}`, handler);
    ipcMain.handle(`smasher:${channel}`, handler);
  };

  // Autonomous First-Run Bootstrapper
  registerIpc('installBinaries', async () => {
    return binaryManager.installMissingBinaries((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('vortex:bootstrapProgress', progress);
      }
    });
  });

  registerIpc('getBinariesStatus', async () => {
    return binaryManager.getStatus();
  });

  registerIpc('fetchMetadata', async (_, url: string) => {
    return downloader.fetchMetadata(url);
  });

  registerIpc('startDownload', async (_, options: DownloadOptions) => {
    const downloadId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    let initialTitle = options.url;
    try {
      const parsed = new URL(options.url);
      initialTitle = (parsed.hostname + parsed.pathname).replace(/^\//, '');
    } catch {}

    // 1. Save initial record immediately (no blocking)
    database.saveLibraryItem({
      id: downloadId,
      url: options.url,
      title: initialTitle,
      filename: '',
      filepath: '',
      format: options.formatPreset,
      resolution: 'auto',
      filesize: 0,
      duration: 0,
      download_date: new Date().toISOString(),
      status: 'downloading',
      thumbnail_url: '',
      category_id: options.categoryId
    });

    // 2. Fetch metadata asynchronously in background
    downloader.fetchMetadata(options.url).then(meta => {
      if (meta) {
        database.updateLibraryItemMeta(downloadId, meta.title, meta.thumbnail, meta.duration);
        if (meta.chapters && meta.chapters.length > 0) {
          database.savePointsOfInterest(
            downloadId,
            meta.chapters.map(c => ({ timestamp: c.start_time, title: c.title, type: 'chapter' }))
          );
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vortex:libraryUpdated');
          mainWindow.webContents.send('smasher:libraryUpdated');
        }
      }
    }).catch(err => {
      console.warn('Notice: Background metadata fetch skipped/timed out:', err.message);
    });

    // 3. Start download immediately
    downloader.startDownload(
      downloadId,
      options,
      (filepath, filesize, title) => {
        database.updateItemStatus(downloadId, 'completed', filepath, filesize, title);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vortex:libraryUpdated');
          mainWindow.webContents.send('smasher:libraryUpdated');
        }
      },
      (err) => {
        database.updateItemStatus(downloadId, 'error');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vortex:libraryUpdated');
          mainWindow.webContents.send('smasher:libraryUpdated');
        }
      }
    );

    return { downloadId };
  });

  registerIpc('cancelDownload', async (_, id: string) => {
    const ok = downloader.cancelDownload(id);
    if (ok) {
      database.updateItemStatus(id, 'cancelled');
    }
    return ok;
  });

  registerIpc('getLibrary', async (_, filter) => {
    return database.getLibraryItems(filter);
  });

  registerIpc('deleteItem', async (_, id: string) => {
    database.deleteLibraryItem(id);
    return true;
  });

  registerIpc('getCategories', async () => {
    return database.getCategories();
  });

  registerIpc('addCategory', async (_, name: string, color: string) => {
    database.addCategory(name, color);
    return true;
  });

  registerIpc('getStats', async () => {
    return database.getStats();
  });

  registerIpc('openFile', async (_, filePath: string) => {
    if (!filePath) return;
    const normalized = path.normalize(filePath);
    if (fs.existsSync(normalized)) {
      await shell.openPath(normalized);
    } else {
      const dir = path.dirname(normalized);
      if (fs.existsSync(dir)) await shell.openPath(dir);
    }
  });

  registerIpc('openFolder', async (_, filePath: string) => {
    if (!filePath) {
      await shell.openPath(path.join(os.homedir(), 'Downloads'));
      return;
    }
    const normalized = path.normalize(filePath);
    if (fs.existsSync(normalized)) {
      shell.showItemInFolder(normalized);
    } else {
      const dir = path.dirname(normalized);
      if (fs.existsSync(dir)) {
        await shell.openPath(dir);
      } else {
        await shell.openPath(path.join(os.homedir(), 'Downloads'));
      }
    }
  });

  registerIpc('selectFolder', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return res.canceled ? null : res.filePaths[0];
  });

  // QR Share & In-App Streaming Server
  const qrServer = new VortexQrServer(database, downloader);

  // Auto-start streaming and LAN server on app ready
  qrServer.start().then(status => {
    console.log(`[Vortex] Media streaming and QR server online on port ${status.port} (${status.localIp})`);
  }).catch(err => {
    console.warn('[Vortex] Streaming server notice:', err.message);
  });

  registerIpc('getQrServerStatus', async () => {
    return qrServer.getStatus();
  });

  registerIpc('startQrServer', async () => {
    return qrServer.start();
  });

  registerIpc('stopQrServer', async () => {
    return qrServer.stop();
  });

  registerIpc('configureFirewallAndNetwork', async () => {
    return new Promise((resolve) => {
      const batScript = `@echo off
netsh advfirewall firewall delete rule name="Vortex LAN Server" >nul 2>&1
netsh advfirewall firewall add rule name="Vortex LAN Server" dir=in action=allow protocol=TCP localport=6767 profile=any
powershell -Command "Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private" >nul 2>&1
netsh advfirewall firewall add rule name="Vortex ICMP" dir=in action=allow protocol=icmpv4:8,any >nul 2>&1
`;
      const tempBat = path.join(os.tmpdir(), 'vortex_firewall_setup.bat');
      fs.writeFileSync(tempBat, batScript, 'utf-8');

      const cmd = `powershell -Command "Start-Process cmd -ArgumentList '/c \\"${tempBat}\\"' -Verb RunAs -Wait"`;
      exec(cmd, (error) => {
        try { fs.unlinkSync(tempBat); } catch {}
        resolve(!error);
      });
    });
  });

  // Maintenance & Repair
  registerIpc('reconcileLibrary', async (_, scanFolder?: string) => {
    return database.reconcileLibrary(scanFolder);
  });

  registerIpc('refetchMetadata', async (_, libraryId: string, url: string) => {
    try {
      const meta = await downloader.fetchMetadata(url);
      database.saveLibraryItem({
        id: libraryId,
        url,
        title: meta.title,
        filename: '',
        filepath: '',
        format: 'auto',
        resolution: 'auto',
        filesize: 0,
        duration: meta.duration,
        download_date: new Date().toISOString(),
        status: 'completed',
        thumbnail_url: meta.thumbnail
      });

      if (meta.chapters && meta.chapters.length > 0) {
        database.savePointsOfInterest(
          libraryId,
          meta.chapters.map(c => ({ timestamp: c.start_time, title: c.title, type: 'chapter' }))
        );
      }
      return { success: true, meta };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Database Backup & Restore
  registerIpc('backupDatabase', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar Copia de Seguridad de Vortex',
      defaultPath: `vortex-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON Backup', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePath) return null;
    return database.backupDatabase(res.filePath);
  });

  registerIpc('restoreDatabase', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar Copia de Seguridad para Restaurar',
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return database.restoreDatabase(res.filePaths[0]);
  });

  registerIpc('getPointsOfInterest', async (_, libraryId: string) => {
    return database.getPointsOfInterest(libraryId);
  });

  registerIpc('getSubtitles', async (_, libraryId: string) => {
    return database.getSubtitles(libraryId);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
