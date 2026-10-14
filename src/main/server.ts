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
            res.end('<h3>Archivo no encontrado en la base de datos.</h3>');
            return;
          }

          if (item.status === 'downloading' || !item.filepath || !fs.existsSync(item.filepath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html><body style="font-family:sans-serif;background:#0d0817;color:#fff;padding:24px;text-align:center;">
                <h2>⏳ El archivo aún se está descargando en el PC...</h2>
                <p>Espera unos segundos a que termine la descarga y vuelve a intentar.</p>
                <a href="/" style="color:#ff2a85;font-weight:bold;text-decoration:none;display:inline-block;margin-top:16px;">⬅️ Volver a la página principal</a>
              </body></html>
            `);
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Vortex Mobile</title>
  <style>
    :root { --accent: #ff2a85; --bg: #0d0817; --card: #19102b; --text: #f0edf7; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 16px; min-height: 100vh; }
    h1 { font-size: 1.4rem; color: var(--accent); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .card { background: var(--card); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.08); }
    input, select, button { width: 100%; padding: 12px; border-radius: 8px; border: none; font-size: 1rem; margin-top: 8px; }
    input { background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.15); }
    select { background: #261a40; color: #fff; }
    button { background: var(--accent); color: #fff; font-weight: bold; cursor: pointer; margin-top: 12px; }
    .item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .item-title { font-size: 0.9rem; font-weight: 600; max-width: 65%; overflow: hidden; text-overflow: ellipsis; }
    .dl-btn { background: #ff2a85; color: #fff; border-radius: 6px; padding: 8px 12px; font-size: 0.8rem; font-weight: bold; text-decoration: none; display: inline-block; white-space: nowrap; }
    .badge-dl { font-size: 0.75rem; color: #f59e0b; padding: 6px 10px; background: rgba(245,158,11,0.15); border-radius: 6px; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>Vortex Mobile</h1>
  
  <div class="card">
    <h3 style="font-size:1rem;margin-bottom:6px;">Enviar enlace a tu PC</h3>
    <p style="font-size:0.8rem;opacity:0.7;">Pega un enlace y tu computadora comenzará a descargarlo inmediatamente.</p>
    <input type="text" id="urlInput" placeholder="https://youtube.com/watch?v=...">
    <select id="presetSelect">
      <option value="mp4">Video MP4 (Universal: Móvil y PC)</option>
      <option value="1080p">Video 1080p FHD (MP4)</option>
      <option value="720p">Video 720p HD (MP4)</option>
      <option value="mp3">Audio MP3 320k (Universal)</option>
      <option value="m4a">Audio M4A / AAC</option>
      <option value="flac">Audio FLAC Hi-Res</option>
    </select>
    <button onclick="sendToPc()">Iniciar Descarga en PC</button>
    <p id="msg" style="font-size:0.8rem;margin-top:8px;color:#4ade80;display:none;"></p>
  </div>

  <div class="card">
    <h3 style="font-size:1rem;margin-bottom:8px;">Descargar a tu Teléfono</h3>
    <div id="libraryList">Cargando biblioteca del PC...</div>
  </div>

  <script>
    async function loadLibrary() {
      try {
        const res = await fetch('/api/library');
        const items = await res.json();
        const list = document.getElementById('libraryList');
        if (!items || items.length === 0) {
          list.innerHTML = '<p style="font-size:0.85rem;opacity:0.5;">No hay descargas en el PC.</p>';
          return;
        }
        list.innerHTML = items.map(i => {
          const isDone = i.status === 'completed' && i.filepath;
          const isDl = i.status === 'downloading';
          return \`
            <div class="item">
              <div class="item-title">
                <div>\${i.title || 'Sin título'}</div>
                <div style="font-size:0.75rem;opacity:0.6;margin-top:2px;">
                  \${(i.format || '').toUpperCase()} \${i.filesize > 0 ? '• ' + (i.filesize / (1024*1024)).toFixed(1) + ' MB' : ''}
                </div>
              </div>
              \${isDone 
                ? \`<a class="dl-btn" href="/api/download-file/\${i.id}" download>Guardar en Móvil</a>\`
                : isDl 
                  ? \`<span class="badge-dl">Descargando...</span>\`
                  : \`<span style="font-size:0.75rem;color:#ef4444;">Error</span>\`
              }
            </div>
          \`;
        }).join('');
      } catch (e) {
        document.getElementById('libraryList').innerText = 'Error conectando al PC.';
      }
    }

    async function sendToPc() {
      const url = document.getElementById('urlInput').value.trim();
      if (!url) return;
      const preset = document.getElementById('presetSelect').value;
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formatPreset: preset })
      });
      const data = await res.json();
      const msg = document.getElementById('msg');
      if (data.success) {
        msg.style.display = 'block';
        msg.innerText = '[OK] ¡Enviado a tu PC! Descargando...';
        document.getElementById('urlInput').value = '';
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
        loadLibrary();
      }
    }

    loadLibrary();
    // Auto-actualizar cada 3.5 segundos mientras se descargan cosas
    setInterval(loadLibrary, 3500);
  </script>
</body>
</html>`;
  }
}

export { VortexQrServer as SmasherQrServer };
