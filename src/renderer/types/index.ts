export interface VideoMetadata {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  description?: string;
  formats: VideoFormat[];
  chapters?: Chapter[];
}

export interface Chapter {
  start_time: number;
  end_time: number;
  title: string;
}

export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  fps?: number;
}

export type DownloadStatus = 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';

export interface DownloadProgress {
  id: string;
  title?: string;
  status: DownloadStatus;
  percent: number;
  speed: string;
  eta: string;
  totalSize: string;
  downloadedSize: string;
  error?: string;
}

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  filename: string;
  filepath: string;
  format: string;
  resolution: string;
  filesize: number;
  duration: number;
  download_date: string;
  status: DownloadStatus;
  thumbnail_url: string;
  category_id?: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon?: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface PointOfInterest {
  id: number;
  library_id: string;
  timestamp: number;
  title: string;
  type: string;
}

export interface SubtitleTrack {
  id: number;
  library_id: string;
  lang: string;
  format: string;
  filepath: string;
}

export interface DownloadOptions {
  url: string;
  formatPreset: string;
  mediaType?: 'video' | 'audio';
  videoResolution?: 'best' | '4k' | '1440p' | '1080p' | '720p' | '480p';
  videoContainer?: 'mp4' | 'mkv' | 'webm';
  audioFormat?: 'mp3' | 'm4a' | 'flac' | 'wav' | 'opus';
  customFormat?: string;
  downloadDir?: string;
  enableSponsorblock: boolean;
  browserCookies?: 'none' | 'brave' | 'chrome' | 'firefox' | 'edge';
  extractAudioOnly?: boolean;
  embedThumbnail?: boolean;
  embedSubtitles?: boolean;
  categoryId?: number;
}

export interface BootstrapProgress {
  step: 'idle' | 'downloading-ytdlp' | 'downloading-ffmpeg' | 'extracting' | 'verifying' | 'completed' | 'error';
  percent: number;
  message: string;
  speed?: string;
  transferred?: string;
  total?: string;
  error?: string;
}

export interface SystemBinariesStatus {
  ytdlp: { found: boolean; path: string; version?: string };
  ffmpeg: { found: boolean; path: string; version?: string };
  deno: { found: boolean; path: string; version?: string };
  ready: boolean;
  needsBootstrap?: boolean;
}

export type ThemePreset =
  | 'cyberpunk'
  | 'synthwave'
  | 'retroTerminal'
  | 'hacker'
  | 'midnight'
  | 'noir'
  | 'solarized'
  | 'vapor'
  | 'cosmic'
  | 'coffee'
  | 'forest'
  | 'autumn'
  | 'christmas'
  | 'halloween'
  | 'spring';

export interface QrServerStatus {
  running: boolean;
  port: number;
  localIp: string;
  serverUrl: string;
  qrDataUrl: string;
}

declare global {
  interface Window {
    vortexAPI?: any;
    smasherAPI?: any;
  }
}


