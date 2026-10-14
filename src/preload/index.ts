import { contextBridge, ipcRenderer } from 'electron';
import { DownloadOptions, DownloadProgress, BootstrapProgress } from '../renderer/types';

const api = {
  // First-run Autonomous Bootstrapper
  installBinaries: () => ipcRenderer.invoke('vortex:installBinaries'),
  onBootstrapProgress: (callback: (progress: BootstrapProgress) => void) => {
    const handler = (_: any, data: BootstrapProgress) => callback(data);
    ipcRenderer.on('vortex:bootstrapProgress', handler);
    return () => ipcRenderer.removeListener('vortex:bootstrapProgress', handler);
  },

  getBinariesStatus: () => ipcRenderer.invoke('vortex:getBinariesStatus'),
  fetchMetadata: (url: string) => ipcRenderer.invoke('vortex:fetchMetadata', url),
  startDownload: (options: DownloadOptions) => ipcRenderer.invoke('vortex:startDownload', options),
  cancelDownload: (id: string) => ipcRenderer.invoke('vortex:cancelDownload', id),
  getLibrary: (filter?: any) => ipcRenderer.invoke('vortex:getLibrary', filter),
  deleteItem: (id: string) => ipcRenderer.invoke('vortex:deleteItem', id),
  getCategories: () => ipcRenderer.invoke('vortex:getCategories'),
  addCategory: (name: string, color: string) => ipcRenderer.invoke('vortex:addCategory', name, color),
  getStats: () => ipcRenderer.invoke('vortex:getStats'),
  openFile: (filePath: string) => ipcRenderer.invoke('vortex:openFile', filePath),
  openFolder: (filePath: string) => ipcRenderer.invoke('vortex:openFolder', filePath),
  selectFolder: () => ipcRenderer.invoke('vortex:selectFolder'),

  // QR Share Local LAN Server
  getQrServerStatus: () => ipcRenderer.invoke('vortex:getQrServerStatus'),
  startQrServer: () => ipcRenderer.invoke('vortex:startQrServer'),
  stopQrServer: () => ipcRenderer.invoke('vortex:stopQrServer'),
  configureFirewallAndNetwork: () => ipcRenderer.invoke('vortex:configureFirewallAndNetwork'),

  // Maintenance & Repair
  reconcileLibrary: (scanFolder?: string) => ipcRenderer.invoke('vortex:reconcileLibrary', scanFolder),
  refetchMetadata: (libraryId: string, url: string) => ipcRenderer.invoke('vortex:refetchMetadata', libraryId, url),

  // Backup & Restore
  backupDatabase: () => ipcRenderer.invoke('vortex:backupDatabase'),
  restoreDatabase: () => ipcRenderer.invoke('vortex:restoreDatabase'),

  // Chapters & Subtitles
  getPointsOfInterest: (libraryId: string) => ipcRenderer.invoke('vortex:getPointsOfInterest', libraryId),
  getSubtitles: (libraryId: string) => ipcRenderer.invoke('vortex:getSubtitles', libraryId),

  onProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_: any, data: DownloadProgress) => callback(data);
    ipcRenderer.on('vortex:onProgress', handler);
    ipcRenderer.on('smasher:onProgress', handler);
    return () => {
      ipcRenderer.removeListener('vortex:onProgress', handler);
      ipcRenderer.removeListener('smasher:onProgress', handler);
    };
  },

  onLibraryUpdated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('vortex:libraryUpdated', handler);
    ipcRenderer.on('smasher:libraryUpdated', handler);
    return () => {
      ipcRenderer.removeListener('vortex:libraryUpdated', handler);
      ipcRenderer.removeListener('smasher:libraryUpdated', handler);
    };
  }
};

contextBridge.exposeInMainWorld('vortexAPI', api);
contextBridge.exposeInMainWorld('smasherAPI', api);

export type VortexAPI = typeof api;
export type SmasherAPI = typeof api;
