import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { SmasherDatabase } from './database';
import { SmasherDownloader } from './downloader';
import { QrServerStatus } from '../renderer/types';

export class VortexQrServer {
  private server: http.Server | null = null;
  private port = 6767;
  private database: SmasherDatabase;
  private downloader: SmasherDownloader;
  private isRunning = false;

  constructor(database: SmasherDatabase, downloader: SmasherDownloader) {
    this.database = database;
    this.downloader = downloader;
  }

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    let fallbackIp = '127.0.0.1';

    for (const [name, ifaceList] of Object.entries(interfaces)) {
      const lower = name.toLowerCase();
      // Skip virtual adapters (Hyper-V, WSL, VirtualBox, VMware, Tailscale)
      if (lower.includes('vethernet') || lower.includes('virtual') || lower.includes('vmware') || lower.includes('wsl') || lower.includes('tailscale')) {
        continue;
      }
      for (const iface of ifaceList || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          // Prioritize standard home/LAN addresses
          if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
            return iface.address;
          }
          if (fallbackIp === '127.0.0.1') {
            fallbackIp = iface.address;
          }
        }
      }
    }
    return fallbackIp;
  }

  public async getStatus(): Promise<QrServerStatus> {
    const localIp = this.getLocalIp();
    const serverUrl = `http://${localIp}:${this.port}`;
    let qrDataUrl = '';

    if (this.isRunning) {
      try {
        qrDataUrl = await QRCode.toDataURL(serverUrl, {
          width: 320,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch (e) {
        console.error('Error generating QR code:', e);
      }
    }

    return {
      running: this.isRunning,
      port: this.port,
      localIp,
      serverUrl,
      qrDataUrl
    };
  }

  public async start(): Promise<QrServerStatus> {
    if (this.isRunning) return this.getStatus();

    return new Promise(resolve => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);

        // CORS headers for local LAN
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Endpoint: Server health and LAN ping
        if (url.pathname === '/api/ping' && req.method === 'GET') {
          const stats = this.database.getStats ? this.database.getStats() : { totalCount: 0, totalSize: 0 };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            version: '1.0.0',
            localIp: this.getLocalIp(),
            port: this.port,
            timestamp: Date.now(),
            stats
          }));
          return;
        }

        // Endpoint: List library for mobile
        if (url.pathname === '/api/library' && req.method === 'GET') {
          const items = this.database.getLibraryItems();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(items));
          return;
        }

        // Endpoint: Send URL from mobile to PC
        if (url.pathname === '/api/download' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { url: mediaUrl, formatPreset = 'mp4' } = JSON.parse(body);
              if (!mediaUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Falta URL' }));
                return;
              }

              const isAudio = ['mp3', 'm4a', 'flac'].includes(formatPreset);
              const downloadId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
              
              this.database.saveLibraryItem({
                id: downloadId,
                url: mediaUrl,
                title: 'Descarga enviada desde Móvil',
                filename: '',
                filepath: '',
                format: isAudio ? formatPreset : 'mp4',
                resolution: formatPreset === '1080p' ? '1080p' : formatPreset === '720p' ? '720p' : 'auto',
                filesize: 0,
                duration: 0,
                download_date: new Date().toISOString(),
                status: 'downloading',
                thumbnail_url: ''
              });

              this.downloader.startDownload(
                downloadId,
                {
                  url: mediaUrl,
                  formatPreset: isAudio ? formatPreset : 'mp4',
                  mediaType: isAudio ? 'audio' : 'video',
                  videoContainer: 'mp4',
                  videoResolution: formatPreset === '1080p' ? '1080p' : formatPreset === '720p' ? '720p' : 'best',
                  audioFormat: isAudio ? (formatPreset as any) : 'mp3',
                  enableSponsorblock: true
                },
                (filepath, filesize, title) => {
                  this.database.updateItemStatus(downloadId, 'completed', filepath, filesize, title);
                },
                () => {
                  this.database.updateItemStatus(downloadId, 'error');
                }
              );

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, downloadId }));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // Endpoint: Stream media for in-app player (Range / 206 Partial Content)
        if (url.pathname.startsWith('/api/stream') && req.method === 'GET') {
          let targetPath = '';

          if (url.pathname === '/api/stream-file') {
            const raw = url.searchParams.get('path');
            if (raw) targetPath = decodeURIComponent(raw);
          } else if (url.pathname.startsWith('/api/stream/')) {
            const id = decodeURIComponent(url.pathname.replace('/api/stream/', ''));
            const items = this.database.getLibraryItems();
            const item = items.find(i => i.id === id);
            if (item && item.filepath) {
              targetPath = item.filepath;
            }
          }

          if (!targetPath || !fs.existsSync(targetPath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Archivo no encontrado');
            return;
          }

          const stat = fs.statSync(targetPath);
          const range = req.headers.range;
          const ext = path.extname(targetPath).toLowerCase();
          const contentType = ext === '.mp3' ? 'audio/mpeg'
            : ext === '.m4a' ? 'audio/mp4'
            : ext === '.flac' ? 'audio/flac'
            : ext === '.wav' ? 'audio/wav'
            : ext === '.opus' ? 'audio/opus'
            : ext === '.webm' ? 'video/webm'
            : ext === '.mkv' ? 'video/x-matroska'
            : ext === '.vtt' ? 'text/vtt'
            : ext === '.srt' ? 'text/plain'
            : 'video/mp4';

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = end - start + 1;
            const file = fs.createReadStream(targetPath, { start, end });

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': contentType,
              'Content-Disposition': 'inline'
            });
            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': stat.size,
              'Content-Type': contentType,
              'Accept-Ranges': 'bytes',
              'Content-Disposition': 'inline'
            });
            fs.createReadStream(targetPath).pipe(res);
          }
          return;
        }

        // Endpoint: Stream / Download file directly to mobile phone
        if (url.pathname.startsWith('/api/download-file/') && req.method === 'GET') {
          const id = url.pathname.replace('/api/download-file/', '');
          const items = this.database.getLibraryItems();
          const item = items.find(i => i.id === id);

          if (!item) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Vortex - Archivo no encontrado</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { min-height: 100vh; background: #07090e; color: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: rgba(18, 24, 38, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 32px 24px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); backdrop-filter: blur(16px); }
    .icon-box { width: 64px; height: 64px; margin: 0 auto 20px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; justify-content: center; color: #ef4444; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 10px; }
    p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px 20px; border-radius: 12px; background: linear-gradient(135deg, #00e5ff 0%, #ff2a85 100%); color: #fff; font-weight: 700; text-decoration: none; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
    </div>
    <h2>Archivo no encontrado</h2>
    <p>El elemento solicitado no existe en la base de datos de Vortex o fue movido en el PC.</p>
    <a href="/" class="btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      Volver a la Biblioteca
    </a>
  </div>
</body>
</html>`);
            return;
          }

          if (item.status === 'downloading' || !item.filepath || !fs.existsSync(item.filepath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Vortex - Procesando descarga</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { min-height: 100vh; background: #07090e; color: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: rgba(18, 24, 38, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 32px 24px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); backdrop-filter: blur(16px); }
    .icon-box { width: 64px; height: 64px; margin: 0 auto 20px; border-radius: 50%; background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.25); display: flex; align-items: center; justify-content: center; color: #00e5ff; }
    .spin { animation: spin 1.8s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 10px; }
    p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px 20px; border-radius: 12px; background: linear-gradient(135deg, #00e5ff 0%, #ff2a85 100%); color: #fff; font-weight: 700; text-decoration: none; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">
      <svg class="spin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
    </div>
    <h2>Descarga en progreso en tu PC</h2>
    <p>El archivo aún se está descargando y ensamblando en tu computadora. En unos instantes estará listo para transferirse.</p>
    <a href="/" class="btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      Volver a la Biblioteca
    </a>
  </div>
</body>
</html>`);
            return;
          }

          const stat = fs.statSync(item.filepath);
          const range = req.headers.range;
          const contentType = item.filepath.endsWith('.mp3') ? 'audio/mpeg'
            : item.filepath.endsWith('.m4a') ? 'audio/mp4'
            : item.filepath.endsWith('.flac') ? 'audio/flac'
            : item.filepath.endsWith('.webm') ? 'video/webm'
            : 'video/mp4';

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = end - start + 1;
            const file = fs.createReadStream(item.filepath, { start, end });

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': contentType
            });
            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': stat.size,
              'Content-Type': contentType,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(item.filepath))}"`
            });
            fs.createReadStream(item.filepath).pipe(res);
          }
          return;
        }

        // Endpoint: Mobile Web Client
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.getMobileHtml());
      });

      this.server.listen(this.port, '0.0.0.0', async () => {
        this.isRunning = true;
        const status = await this.getStatus();
        resolve(status);
      });
    });
  }

  public stop(): Promise<QrServerStatus> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(async () => {
          this.isRunning = false;
          this.server = null;
          resolve(await this.getStatus());
        });
      } else {
        this.isRunning = false;
        resolve(this.getStatus());
      }
    });
  }

  private getMobileHtml(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#07090e">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Vortex - Transferencia Móvil</title>
  <style>
    :root {
      --bg-base: #07090e;
      --bg-surface: rgba(15, 20, 32, 0.72);
      --bg-surface-elevated: rgba(22, 29, 47, 0.88);
      --bg-card: rgba(18, 24, 38, 0.65);
      --bg-card-hover: rgba(26, 34, 54, 0.85);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(0, 229, 255, 0.35);
      --accent-cyan: #00e5ff;
      --accent-magenta: #ff2a85;
      --accent-gradient: linear-gradient(135deg, #00e5ff 0%, #ff2a85 100%);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --status-green: #10b981;
      --status-amber: #f59e0b;
      --status-red: #ef4444;
      --radius-sm: 8px;
      --radius-md: 14px;
      --radius-lg: 20px;
      --radius-full: 9999px;
      --shadow-glass: 0 12px 32px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
      --transition-fast: 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      --transition-smooth: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      width: 100%;
      min-height: 100vh;
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow-x: clip;
    }

    /* Ambient cyber gradient background */
    .ambient-glow {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 0;
      background:
        radial-gradient(circle 380px at 15% 10%, rgba(0, 229, 255, 0.08), transparent 70%),
        radial-gradient(circle 420px at 85% 85%, rgba(255, 42, 133, 0.07), transparent 70%),
        radial-gradient(circle 300px at 50% 50%, rgba(124, 58, 237, 0.04), transparent 70%);
    }

    .app-container {
      position: relative;
      z-index: 1;
      max-width: 600px;
      margin: 0 auto;
      padding: 0 16px;
      padding-top: max(16px, env(safe-area-inset-top));
      padding-bottom: max(32px, env(safe-area-inset-bottom));
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation Header */
    header {
      position: sticky;
      top: 0;
      z-index: 40;
      margin: 0 -16px 16px -16px;
      padding: 12px 16px;
      background: rgba(7, 9, 14, 0.82);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1.1;
    }

    .brand-sub {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-full);
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      font-size: 0.75rem;
      font-weight: 600;
      color: #34d399;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .status-pill:active {
      transform: scale(0.96);
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .icon-btn:active {
      transform: scale(0.92);
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
    }

    /* Segmented Tabs Navigation */
    .tabs-bar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 4px;
      background: rgba(15, 20, 32, 0.85);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      margin-bottom: 20px;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 12px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      min-height: 44px;
    }

    .tab-btn.active {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      font-size: 0.7rem;
      font-weight: 700;
      background: rgba(0, 229, 255, 0.15);
      color: var(--accent-cyan);
    }

    /* Tab Panels */
    .tab-panel {
      display: none;
      flex-direction: column;
      gap: 16px;
    }

    .tab-panel.active {
      display: flex;
    }

    /* Card Panels */
    .panel-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 20px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: var(--shadow-glass);
      transition: border-color var(--transition-fast);
    }

    .panel-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }

    .panel-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(0, 229, 255, 0.1);
      border: 1px solid rgba(0, 229, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-cyan);
      flex-shrink: 0;
    }

    .panel-title-wrap h2 {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .panel-title-wrap p {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* Search & Filter Toolbar */
    .search-wrapper {
      position: relative;
      margin-bottom: 12px;
    }

    .search-input {
      width: 100%;
      height: 44px;
      padding: 0 40px 0 40px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      transition: all var(--transition-fast);
    }

    .search-input:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.15);
    }

    .search-icon-left {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-clear-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 4px;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
    }

    .filter-chips {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }

    .filter-chips::-webkit-scrollbar {
      display: none;
    }

    .chip-btn {
      padding: 8px 14px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-subtle);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-secondary);
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      min-height: 36px;
      transition: all var(--transition-fast);
    }

    .chip-btn.active {
      background: rgba(0, 229, 255, 0.12);
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }

    /* Library Media Cards */
    .library-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .media-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 16px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all var(--transition-fast);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .media-card:active {
      background: var(--bg-card-hover);
    }

    .media-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .media-badge-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .media-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .badge-video {
      background: rgba(0, 229, 255, 0.12);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 229, 255, 0.25);
    }

    .badge-audio {
      background: rgba(255, 42, 133, 0.12);
      color: var(--accent-magenta);
      border: 1px solid rgba(255, 42, 133, 0.25);
    }

    .badge-downloading {
      background: rgba(245, 158, 11, 0.12);
      color: var(--status-amber);
      border: 1px solid rgba(245, 158, 11, 0.25);
    }

    .badge-meta {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
    }

    .media-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .media-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 4px;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      min-height: 44px;
      transition: all var(--transition-fast);
      border: none;
    }

    .btn-stream {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }

    .btn-stream:active {
      background: rgba(255, 255, 255, 0.14);
      transform: scale(0.97);
    }

    .btn-download {
      background: var(--accent-gradient);
      color: #fff;
      box-shadow: 0 4px 14px rgba(0, 229, 255, 0.2);
    }

    .btn-download:active {
      opacity: 0.9;
      transform: scale(0.97);
    }

    .downloading-indicator {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      background: rgba(245, 158, 11, 0.06);
      border: 1px solid rgba(245, 158, 11, 0.18);
      border-radius: 10px;
    }

    .indicator-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.78rem;
      color: var(--status-amber);
      font-weight: 600;
    }

    .progress-track {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-full);
      overflow: hidden;
      position: relative;
    }

    .progress-bar-indeterminate {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 40%;
      background: linear-gradient(90deg, transparent, #f59e0b, transparent);
      animation: indeterminate 1.5s infinite;
    }

    @keyframes indeterminate {
      0% { left: -40%; }
      100% { left: 100%; }
    }

    /* Send Form Controls */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: 0.02em;
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-main {
      width: 100%;
      height: 48px;
      padding: 0 95px 0 42px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: #fff;
      font-size: 0.92rem;
      outline: none;
      transition: all var(--transition-fast);
    }

    .input-main:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.15);
    }

    .input-icon-left {
      position: absolute;
      left: 14px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .paste-btn {
      position: absolute;
      right: 8px;
      height: 32px;
      padding: 0 10px;
      border-radius: 8px;
      border: 1px solid rgba(0, 229, 255, 0.3);
      background: rgba(0, 229, 255, 0.1);
      color: var(--accent-cyan);
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .paste-btn:active {
      transform: scale(0.95);
      background: rgba(0, 229, 255, 0.2);
    }

    /* Preset Grid Selector */
    .preset-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 20px;
    }

    .preset-tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      cursor: pointer;
      transition: all var(--transition-fast);
      text-align: left;
    }

    .preset-tile.active {
      background: rgba(0, 229, 255, 0.08);
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 1px var(--accent-cyan);
    }

    .preset-tile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .preset-name {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .preset-sub {
      font-size: 0.72rem;
      color: var(--text-secondary);
    }

    .btn-primary-send {
      width: 100%;
      height: 50px;
      border-radius: var(--radius-md);
      background: var(--accent-gradient);
      border: none;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(0, 229, 255, 0.25);
      transition: all var(--transition-fast);
    }

    .btn-primary-send:active {
      transform: scale(0.98);
      opacity: 0.92;
    }

    .btn-primary-send:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    /* Tip info box */
    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-subtle);
      font-size: 0.78rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    /* Floating Toast */
    .toast-pill {
      position: fixed;
      bottom: max(24px, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%) translateY(120%);
      padding: 12px 20px;
      border-radius: var(--radius-full);
      background: rgba(18, 24, 38, 0.92);
      border: 1px solid var(--border-accent);
      color: #fff;
      font-size: 0.85rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 100;
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
      opacity: 0;
      pointer-events: none;
      max-width: 90vw;
      white-space: nowrap;
    }

    .toast-pill.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    /* Media Player Bottom Sheet Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(4, 6, 10, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 80;
      display: none;
      align-items: flex-end;
      justify-content: center;
      padding: 0;
    }

    .modal-overlay.open {
      display: flex;
    }

    .modal-sheet {
      width: 100%;
      max-width: 600px;
      background: rgba(18, 24, 38, 0.95);
      border: 1px solid var(--border-subtle);
      border-bottom: none;
      border-radius: 24px 24px 0 0;
      padding: 20px 20px max(24px, env(safe-area-inset-bottom)) 20px;
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .modal-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--text-primary);
      max-width: 80%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player-wrap {
      width: 100%;
      border-radius: 14px;
      overflow: hidden;
      background: #000;
      position: relative;
    }

    video {
      width: 100%;
      max-height: 50vh;
      display: block;
      outline: none;
    }

    audio {
      width: 100%;
      outline: none;
      margin: 12px 0;
    }

    .audio-visual-wrap {
      padding: 30px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: linear-gradient(180deg, rgba(255, 42, 133, 0.08) 0%, transparent 100%);
      border-radius: 12px;
    }

    .audio-disc-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(255, 42, 133, 0.15);
      border: 1px solid rgba(255, 42, 133, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-magenta);
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }

    .empty-state h3 {
      font-size: 1rem;
      color: var(--text-primary);
    }

    .empty-state p {
      font-size: 0.82rem;
      color: var(--text-secondary);
      max-width: 300px;
      line-height: 1.4;
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <div class="ambient-glow"></div>

  <div class="app-container">
    <!-- Header -->
    <header>
      <div class="brand-wrap">
        <div class="brand-logo">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="url(#vortexGrad)" stroke-width="2.5" />
            <path d="M10 12l6 10 6-10" stroke="url(#vortexGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <defs>
              <linearGradient id="vortexGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#00e5ff" />
                <stop offset="1" stop-color="#ff2a85" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-title">VORTEX</span>
          <span class="brand-sub">Transfer LAN</span>
        </div>
      </div>

      <div class="header-actions">
        <div class="status-pill" id="statusPill" onclick="checkHealth()">
          <span class="pulse-dot" id="statusDot"></span>
          <span id="statusText">PC Conectada</span>
        </div>
        <button class="icon-btn" onclick="loadLibrary(true)" title="Actualizar" aria-label="Actualizar biblioteca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <div class="tabs-bar">
      <button class="tab-btn active" id="tabBtnLibrary" onclick="switchTab('library')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        Descargas PC
        <span class="tab-badge" id="libraryCountBadge">0</span>
      </button>

      <button class="tab-btn" id="tabBtnSend" onclick="switchTab('send')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Enviar Enlace
      </button>
    </div>

    <!-- TAB 1: PC LIBRARY -->
    <div class="tab-panel active" id="panelLibrary">
      <div class="search-wrapper">
        <span class="search-icon-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <input type="text" class="search-input" id="searchInput" placeholder="Buscar por título o formato..." oninput="handleSearch()">
        <button class="search-clear-btn" id="searchClearBtn" onclick="clearSearch()" aria-label="Limpiar búsqueda">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="filter-chips">
        <button class="chip-btn active" data-filter="all" onclick="setFilter('all')">Todos</button>
        <button class="chip-btn" data-filter="video" onclick="setFilter('video')">Videos</button>
        <button class="chip-btn" data-filter="audio" onclick="setFilter('audio')">Audios</button>
        <button class="chip-btn" data-filter="downloading" onclick="setFilter('downloading')">En Progreso</button>
      </div>

      <div class="library-list" id="libraryList">
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h3>Cargando descargas...</h3>
          <p>Obteniendo el catálogo de archivos de tu computadora.</p>
        </div>
      </div>
    </div>

    <!-- TAB 2: SEND LINK TO PC -->
    <div class="tab-panel" id="panelSend">
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </div>
          <div class="panel-title-wrap">
            <h2>Descargar en tu PC</h2>
            <p>Pega un enlace y tu computadora procesará la descarga con aceleración por hardware.</p>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="urlInput">Enlace multimedia (YouTube, TikTok, Twitter/X, etc.)</label>
          <div class="input-container">
            <span class="input-icon-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </span>
            <input type="url" id="urlInput" class="input-main" placeholder="https://..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <button type="button" class="paste-btn" onclick="pasteFromClipboard()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Pegar
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Formato de descarga</label>
          <div class="preset-grid">
            <div class="preset-tile active" data-preset="mp4" onclick="selectPreset('mp4')">
              <div class="preset-tile-header">
                <span class="preset-name">MP4 Universal</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </div>
              <span class="preset-sub">Compatible Móvil y PC</span>
            </div>

            <div class="preset-tile" data-preset="1080p" onclick="selectPreset('1080p')">
              <div class="preset-tile-header">
                <span class="preset-name">Video 1080p</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </div>
              <span class="preset-sub">Full HD máxima nitidez</span>
            </div>

            <div class="preset-tile" data-preset="720p" onclick="selectPreset('720p')">
              <div class="preset-tile-header">
                <span class="preset-name">Video 720p</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </div>
              <span class="preset-sub">HD ligero y rápido</span>
            </div>

            <div class="preset-tile" data-preset="mp3" onclick="selectPreset('mp3')">
              <div class="preset-tile-header">
                <span class="preset-name">Audio MP3</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-magenta)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
              <span class="preset-sub">320 kbps HQ Universal</span>
            </div>

            <div class="preset-tile" data-preset="m4a" onclick="selectPreset('m4a')">
              <div class="preset-tile-header">
                <span class="preset-name">Audio M4A</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-magenta)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
              <span class="preset-sub">AAC optimizado iOS</span>
            </div>

            <div class="preset-tile" data-preset="flac" onclick="selectPreset('flac')">
              <div class="preset-tile-header">
                <span class="preset-name">Audio FLAC</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-magenta)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
              <span class="preset-sub">Audio Hi-Res sin pérdida</span>
            </div>
          </div>
        </div>

        <button type="button" class="btn-primary-send" id="sendBtn" onclick="sendToPc()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span id="sendBtnText">Iniciar Descarga en PC</span>
        </button>

        <div class="info-box" style="margin-top: 16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>Una vez enviada la orden, podrás seguir el progreso en tiempo real desde la pestaña <strong>Descargas PC</strong> y guardar el archivo en tu teléfono cuando termine.</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Media Player Modal -->
  <div class="modal-overlay" id="playerModal" onclick="handleModalBackdropClick(event)">
    <div class="modal-sheet">
      <div class="modal-top">
        <span class="modal-title" id="modalTitle">Reproductor</span>
        <button class="icon-btn" onclick="closePlayer()" aria-label="Cerrar reproductor">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="player-wrap" id="playerMediaWrap">
        <!-- Injected video or audio -->
      </div>

      <div style="display:flex; gap:8px;">
        <a class="action-btn btn-download" id="modalDownloadBtn" href="#" download style="flex:1;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Guardar en Celular
        </a>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class="toast-pill" id="toastPill">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span id="toastText">Mensaje</span>
  </div>

  <script>
    let rawItems = [];
    let currentFilter = 'all';
    let currentPreset = 'mp4';
    let refreshTimer = null;
    let toastTimeout = null;

    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      if (tab === 'library') {
        document.getElementById('tabBtnLibrary').classList.add('active');
        document.getElementById('panelLibrary').classList.add('active');
        loadLibrary(false);
      } else {
        document.getElementById('tabBtnSend').classList.add('active');
        document.getElementById('panelSend').classList.add('active');
      }
    }

    function selectPreset(preset) {
      currentPreset = preset;
      document.querySelectorAll('.preset-tile').forEach(tile => {
        if (tile.dataset.preset === preset) {
          tile.classList.add('active');
        } else {
          tile.classList.remove('active');
        }
      });
    }

    async function pasteFromClipboard() {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            document.getElementById('urlInput').value = text;
            showToast('Enlace pegado del portapapeles');
            return;
          }
        }
        document.getElementById('urlInput').focus();
      } catch (e) {
        document.getElementById('urlInput').focus();
      }
    }

    function showToast(text, isError = false) {
      const toast = document.getElementById('toastPill');
      const toastText = document.getElementById('toastText');
      toastText.innerText = text;

      if (isError) {
        toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      } else {
        toast.style.borderColor = 'var(--border-accent)';
      }

      toast.classList.add('show');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 3500);
    }

    function setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.chip-btn').forEach(btn => {
        if (btn.dataset.filter === filter) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      renderLibrary();
    }

    function handleSearch() {
      const val = document.getElementById('searchInput').value.trim();
      const clearBtn = document.getElementById('searchClearBtn');
      clearBtn.style.display = val.length > 0 ? 'inline-flex' : 'none';
      renderLibrary();
    }

    function clearSearch() {
      const input = document.getElementById('searchInput');
      input.value = '';
      document.getElementById('searchClearBtn').style.display = 'none';
      input.focus();
      renderLibrary();
    }

    function formatBytes(bytes) {
      if (!bytes || bytes <= 0) return '';
      const mb = bytes / (1024 * 1024);
      if (mb >= 1024) {
        return (mb / 1024).toFixed(2) + ' GB';
      }
      return mb.toFixed(1) + ' MB';
    }

    function formatDate(iso) {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch (e) {
        return '';
      }
    }

    function renderLibrary() {
      const list = document.getElementById('libraryList');
      const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();

      const filtered = rawItems.filter(item => {
        // Search filter
        if (search) {
          const title = (item.title || '').toLowerCase();
          const format = (item.format || '').toLowerCase();
          if (!title.includes(search) && !format.includes(search)) return false;
        }

        const isAudio = ['mp3', 'm4a', 'flac', 'wav', 'opus'].includes((item.format || '').toLowerCase());
        const isDownloading = item.status === 'downloading';

        if (currentFilter === 'video') return !isAudio && !isDownloading;
        if (currentFilter === 'audio') return isAudio && !isDownloading;
        if (currentFilter === 'downloading') return isDownloading;
        return true;
      });

      document.getElementById('libraryCountBadge').innerText = rawItems.length;

      if (!filtered || filtered.length === 0) {
        if (rawItems.length === 0) {
          list.innerHTML = \`
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3>Biblioteca vacía en tu PC</h3>
              <p>Envía un enlace desde la pestaña superior para comenzar a descargar contenido.</p>
            </div>
          \`;
        } else {
          list.innerHTML = \`
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <h3>Sin coincidencias</h3>
              <p>No se encontraron descargas con ese criterio de búsqueda.</p>
            </div>
          \`;
        }
        return;
      }

      list.innerHTML = filtered.map(item => {
        const isDone = item.status === 'completed' && item.filepath;
        const isDl = item.status === 'downloading';
        const isAudio = ['mp3', 'm4a', 'flac', 'wav', 'opus'].includes((item.format || '').toLowerCase());
        const badgeClass = isDl ? 'badge-downloading' : isAudio ? 'badge-audio' : 'badge-video';
        const formatLabel = (item.format || (isAudio ? 'audio' : 'video')).toUpperCase();
        const sizeLabel = formatBytes(item.filesize);
        const dateLabel = formatDate(item.download_date);

        return \`
          <div class="media-card">
            <div class="media-header">
              <div class="media-badge-wrap">
                <span class="media-badge \${badgeClass}">
                  \${isAudio 
                    ? \`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>\` 
                    : \`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>\`
                  }
                  \${formatLabel}
                </span>
                \${item.resolution && item.resolution !== 'auto' ? \`<span class="media-badge badge-meta">\${item.resolution}</span>\` : ''}
                \${sizeLabel ? \`<span class="media-badge badge-meta">\${sizeLabel}</span>\` : ''}
              </div>
              \${dateLabel ? \`<span style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">\${dateLabel}</span>\` : ''}
            </div>

            <div class="media-title" title="\${escapeHtml(item.title || 'Sin título')}">
              \${escapeHtml(item.title || 'Sin título')}
            </div>

            \${isDl ? \`
              <div class="downloading-indicator">
                <div class="indicator-row">
                  <span>Descargando en PC...</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div class="progress-track">
                  <div class="progress-bar-indeterminate"></div>
                </div>
              </div>
            \` : isDone ? \`
              <div class="media-actions">
                <button class="action-btn btn-stream" onclick="openPlayer('\${item.id}', '\${escapeJs(item.title || 'Reproduciendo')}', '\${item.format}')">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Reproducir
                </button>
                <a class="action-btn btn-download" href="/api/download-file/\${item.id}" download>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Guardar
                </a>
              </div>
            \` : \`
              <div style="font-size:0.8rem;color:var(--status-red);font-weight:600;display:flex;align-items:center;gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Error en la descarga
              </div>
            \`}
          </div>
        \`;
      }).join('');
    }

    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeJs(str) {
      return (str || '').replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
    }

    async function loadLibrary(manual = false) {
      try {
        const res = await fetch('/api/library');
        if (!res.ok) throw new Error('Respuesta no válida');
        rawItems = await res.json();
        renderLibrary();
        if (manual) showToast('Biblioteca actualizada');
      } catch (e) {
        document.getElementById('statusDot').style.background = '#ef4444';
        document.getElementById('statusDot').style.boxShadow = '0 0 10px #ef4444';
        document.getElementById('statusText').innerText = 'Desconectado';
        if (manual) showToast('Error conectando a tu PC', true);
      }
    }

    async function checkHealth() {
      try {
        const start = performance.now();
        const res = await fetch('/api/ping');
        const data = await res.json();
        const latency = Math.round(performance.now() - start);

        if (data.ok) {
          document.getElementById('statusDot').style.background = '#10b981';
          document.getElementById('statusDot').style.boxShadow = '0 0 10px #10b981';
          document.getElementById('statusText').innerText = 'PC En línea (' + latency + ' ms)';
          showToast('Conexión activa con Vortex PC (' + latency + ' ms)');
        }
      } catch (e) {
        document.getElementById('statusDot').style.background = '#ef4444';
        document.getElementById('statusDot').style.boxShadow = '0 0 10px #ef4444';
        document.getElementById('statusText').innerText = 'Desconectado';
        showToast('No se puede conectar con tu PC', true);
      }
    }

    async function sendToPc() {
      const input = document.getElementById('urlInput');
      const url = input.value.trim();
      if (!url) {
        showToast('Por favor introduce un enlace', true);
        input.focus();
        return;
      }

      const btn = document.getElementById('sendBtn');
      const btnText = document.getElementById('sendBtnText');
      btn.disabled = true;
      btnText.innerText = 'Enviando a tu PC...';

      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, formatPreset: currentPreset })
        });
        const data = await res.json();

        if (data.success) {
          input.value = '';
          showToast('Descarga iniciada en tu PC');
          switchTab('library');
          loadLibrary(false);
        } else {
          showToast(data.error || 'Error al iniciar descarga', true);
        }
      } catch (e) {
        showToast('Error de conexión con la PC', true);
      } finally {
        btn.disabled = false;
        btnText.innerText = 'Iniciar Descarga en PC';
      }
    }

    function openPlayer(id, title, format) {
      const modal = document.getElementById('playerModal');
      const mediaWrap = document.getElementById('playerMediaWrap');
      const modalTitle = document.getElementById('modalTitle');
      const downloadBtn = document.getElementById('modalDownloadBtn');

      modalTitle.innerText = title;
      downloadBtn.href = '/api/download-file/' + id;

      const isAudio = ['mp3', 'm4a', 'flac', 'wav', 'opus'].includes((format || '').toLowerCase());
      const streamUrl = '/api/stream/' + encodeURIComponent(id);

      if (isAudio) {
        mediaWrap.innerHTML = \`
          <div class="audio-visual-wrap">
            <div class="audio-disc-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <audio controls autoplay playsinline src="\${streamUrl}" style="width:100%;"></audio>
          </div>
        \`;
      } else {
        mediaWrap.innerHTML = \`
          <video controls autoplay playsinline preload="auto" src="\${streamUrl}"></video>
        \`;
      }

      modal.classList.add('open');
    }

    function closePlayer() {
      const modal = document.getElementById('playerModal');
      const mediaWrap = document.getElementById('playerMediaWrap');
      const video = mediaWrap.querySelector('video');
      const audio = mediaWrap.querySelector('audio');
      if (video) video.pause();
      if (audio) audio.pause();
      mediaWrap.innerHTML = '';
      modal.classList.remove('open');
    }

    function handleModalBackdropClick(event) {
      if (event.target === document.getElementById('playerModal')) {
        closePlayer();
      }
    }

    // Initialize
    loadLibrary(false);
    checkHealth();

    // Auto refresh active tasks
    setInterval(() => {
      const hasDownloading = rawItems.some(i => i.status === 'downloading');
      if (hasDownloading) {
        loadLibrary(false);
      }
    }, 3000);
  </script>
</body>
</html>`;
  }
}

export { VortexQrServer as SmasherQrServer };
