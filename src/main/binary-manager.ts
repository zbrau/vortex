import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';
import { exec, execSync } from 'child_process';
import { SystemBinariesStatus, BootstrapProgress } from '../renderer/types';

export class BinaryManager {
  private vortexDir: string;
  private binDir: string;
  private smasherDir: string;
  private stacherDir: string;

  constructor() {
    const home = os.homedir();
    this.vortexDir = path.join(home, '.vortex');
    this.binDir = path.join(this.vortexDir, 'bin');
    this.smasherDir = path.join(home, '.smasher');
    this.stacherDir = path.join(home, '.stacher');

    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
  }

  public getVortexDir(): string {
    return this.vortexDir;
  }

  // Alias for backward compatibility
  public getSmasherDir(): string {
    return this.vortexDir;
  }

  private cachedBinaries: Map<string, string> = new Map();
  private cachedStatus: SystemBinariesStatus | null = null;

  public getBinDir(): string {
    return this.binDir;
  }

  public invalidateCache(): void {
    this.cachedBinaries.clear();
    this.cachedStatus = null;
  }

  public findBinary(name: string): string {
    const isWin = process.platform === 'win32';
    const exeName = isWin ? `${name}.exe` : name;

    if (this.cachedBinaries.has(name)) {
      const cached = this.cachedBinaries.get(name)!;
      if (cached && fs.existsSync(cached)) return cached;
      this.cachedBinaries.delete(name);
    }

    // 1. Check local .vortex/bin
    const localPath = path.join(this.binDir, exeName);
    if (fs.existsSync(localPath)) {
      this.cachedBinaries.set(name, localPath);
      return localPath;
    }

    // 2. Check legacy .smasher/bin
    const smasherPath = path.join(this.smasherDir, 'bin', exeName);
    if (fs.existsSync(smasherPath)) {
      this.cachedBinaries.set(name, smasherPath);
      return smasherPath;
    }

    // 3. Check legacy .stacher directory
    const stacherPath = path.join(this.stacherDir, exeName);
    if (fs.existsSync(stacherPath)) {
      this.cachedBinaries.set(name, stacherPath);
      return stacherPath;
    }

    // Special check for nested ffmpeg in .stacher
    if (name === 'ffmpeg' || name === 'ffprobe') {
      const nestedStacher = path.join(this.stacherDir, 'ffmpeg-master-latest-win64-gpl', 'bin', exeName);
      if (fs.existsSync(nestedStacher)) {
        this.cachedBinaries.set(name, nestedStacher);
        return nestedStacher;
      }
    }

    // 4. Check system PATH
    try {
      const cmd = isWin ? `where.exe ${name}` : `which ${name}`;
      const found = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 }).trim().split('\n')[0].trim();
      if (found && fs.existsSync(found)) {
        this.cachedBinaries.set(name, found);
        return found;
      }
    } catch {
      // not in path
    }

    return '';
  }

  public getStatus(force = false): SystemBinariesStatus {
    if (!force && this.cachedStatus) {
      return this.cachedStatus;
    }

    const ytdlpPath = this.findBinary('yt-dlp');
    const ffmpegPath = this.findBinary('ffmpeg');
    const denoPath = this.findBinary('deno');

    const getVersion = (binPath: string, arg = '--version') => {
      if (!binPath) return undefined;
      try {
        return execSync(`"${binPath}" ${arg}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 }).trim().split('\n')[0].trim();
      } catch {
        return 'installed';
      }
    };

    const hasYtdlp = !!ytdlpPath;
    const hasFfmpeg = !!ffmpegPath;

    this.cachedStatus = {
      ytdlp: { found: hasYtdlp, path: ytdlpPath, version: getVersion(ytdlpPath) },
      ffmpeg: { found: hasFfmpeg, path: ffmpegPath, version: getVersion(ffmpegPath, '-version') },
      deno: { found: !!denoPath, path: denoPath, version: getVersion(denoPath) },
      ready: hasYtdlp,
      needsBootstrap: !hasYtdlp || !hasFfmpeg
    };

    return this.cachedStatus;
  }

  private downloadWithRedirects(
    url: string,
    destPath: string,
    onProgress?: (data: { transferred: number; total: number; percent: number; speed: string }) => void,
    hops = 0
  ): Promise<void> {
    if (hops > 10) return Promise.reject(new Error('Demasiadas redirecciones HTTP'));

    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https://');
      const client = isHttps ? https : http;

      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 Vortex-AutoBootstrapper',
          'Accept': '*/*'
        }
      }, (res) => {
        // Handle HTTP Redirects (301, 302, 303, 307, 308)
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          let nextUrl = res.headers.location;
          if (!nextUrl.startsWith('http')) {
            const parsed = new URL(url);
            nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
          }
          res.resume(); // Discard data
          return resolve(this.downloadWithRedirects(nextUrl, destPath, onProgress, hops + 1));
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Error de descarga HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let transferredBytes = 0;
        let lastReport = Date.now();
        let lastBytes = 0;
        let speedStr = 'Calculando...';

        const tmpPath = `${destPath}.tmp`;
        const fileStream = fs.createWriteStream(tmpPath);

        res.on('data', (chunk: Buffer) => {
          transferredBytes += chunk.length;
          fileStream.write(chunk);

          const now = Date.now();
          if (now - lastReport >= 300) {
            const timeDiff = (now - lastReport) / 1000;
            const bytesDiff = transferredBytes - lastBytes;
            const bytesPerSec = bytesDiff / (timeDiff || 1);
            speedStr = (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
            lastReport = now;
            lastBytes = transferredBytes;

            const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 50;
            if (onProgress) {
              onProgress({
                transferred: transferredBytes,
                total: totalBytes,
                percent,
                speed: speedStr
              });
            }
          }
        });

        res.on('end', () => {
          fileStream.end(() => {
            try {
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              fs.renameSync(tmpPath, destPath);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });

        res.on('error', (err) => {
          fileStream.close();
          try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
          reject(err);
        });

        fileStream.on('error', (err) => {
          res.destroy();
          try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
          reject(err);
        });
      });

      req.on('error', reject);
      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('Tiempo de espera agotado al descargar'));
      });
    });
  }

  private extractArchive(zipPath: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 1. Try Windows native tar.exe (fastest)
      exec(`tar.exe -xf "${zipPath}" -C "${targetDir}"`, (tarErr) => {
        if (!tarErr) {
          return resolve();
        }

        // 2. Fallback to PowerShell Expand-Archive
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force"`;
        exec(psCmd, (psErr) => {
          if (psErr) {
            reject(new Error(`Fallo extrayendo archivo ZIP: ${psErr.message}`));
          } else {
            resolve();
          }
        });
      });
    });
  }

  private findRecursive(dir: string, filenames: string[]): { [key: string]: string } {
    const results: { [key: string]: string } = {};
    const queue = [dir];

    while (queue.length > 0) {
      const current = queue.shift()!;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            queue.push(full);
          } else if (entry.isFile()) {
            const lower = entry.name.toLowerCase();
            for (const target of filenames) {
              if (lower === target.toLowerCase()) {
                results[target] = full;
              }
            }
          }
        }
      } catch {}
    }
    return results;
  }

  public async installMissingBinaries(
    onProgress?: (progress: BootstrapProgress) => void
  ): Promise<SystemBinariesStatus> {
    const notify = (prog: BootstrapProgress) => {
      if (onProgress) onProgress(prog);
    };

    try {
      if (!fs.existsSync(this.binDir)) {
        fs.mkdirSync(this.binDir, { recursive: true });
      }

      const isWin = process.platform === 'win32';
      const ytdlpExeName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
      const ffmpegExeName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
      const ffprobeExeName = isWin ? 'ffprobe.exe' : 'ffprobe';

      const localYtdlp = path.join(this.binDir, ytdlpExeName);
      const localFfmpeg = path.join(this.binDir, ffmpegExeName);
      const localFfprobe = path.join(this.binDir, ffprobeExeName);

      const hasYtdlp = fs.existsSync(localYtdlp) || !!this.findBinary('yt-dlp');
      const hasFfmpeg = (fs.existsSync(localFfmpeg) && fs.existsSync(localFfprobe)) || (!!this.findBinary('ffmpeg') && !!this.findBinary('ffprobe'));

      // 1. Download yt-dlp if needed
      if (!hasYtdlp) {
        notify({
          step: 'downloading-ytdlp',
          percent: 5,
          message: 'Descargando motor principal yt-dlp...'
        });

        const ytdlpUrl = isWin
          ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
          : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

        await this.downloadWithRedirects(ytdlpUrl, localYtdlp, (info) => {
          notify({
            step: 'downloading-ytdlp',
            percent: Math.min(45, Math.round(5 + (info.percent * 0.4))),
            speed: info.speed,
            transferred: `${(info.transferred / (1024 * 1024)).toFixed(1)} MB`,
            total: info.total ? `${(info.total / (1024 * 1024)).toFixed(1)} MB` : undefined,
            message: `Descargando yt-dlp (${info.speed})`
          });
        });

        // Grant execution permission on unix
        if (!isWin) {
          try { fs.chmodSync(localYtdlp, 0o755); } catch {}
        }
      }

      // 2. Download ffmpeg & ffprobe if needed
      if (!hasFfmpeg) {
        notify({
          step: 'downloading-ffmpeg',
          percent: 50,
          message: 'Descargando transcodificador FFmpeg (esencial para combinar audio y video en MP4)...'
        });

        const ffmpegZip = path.join(this.binDir, 'ffmpeg-bundle.zip');
        const extractDir = path.join(this.binDir, 'temp_ffmpeg_extract');

        // yt-dlp's official FFmpeg Windows GPL release
        const ffmpegUrl = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

        await this.downloadWithRedirects(ffmpegUrl, ffmpegZip, (info) => {
          notify({
            step: 'downloading-ffmpeg',
            percent: Math.min(85, Math.round(50 + (info.percent * 0.35))),
            speed: info.speed,
            transferred: `${(info.transferred / (1024 * 1024)).toFixed(1)} MB`,
            total: info.total ? `${(info.total / (1024 * 1024)).toFixed(1)} MB` : undefined,
            message: `Descargando paquete FFmpeg (${info.speed})`
          });
        });

        notify({
          step: 'extracting',
          percent: 88,
          message: 'Extrayendo FFmpeg y optimizando para Vortex...'
        });

        await this.extractArchive(ffmpegZip, extractDir);

        // Find ffmpeg.exe and ffprobe.exe
        const found = this.findRecursive(extractDir, [ffmpegExeName, ffprobeExeName]);
        if (found[ffmpegExeName]) {
          fs.copyFileSync(found[ffmpegExeName], localFfmpeg);
        }
        if (found[ffprobeExeName]) {
          fs.copyFileSync(found[ffprobeExeName], localFfprobe);
        }

        // Cleanup temporary zip and directory
        try { fs.unlinkSync(ffmpegZip); } catch {}
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
      }

      // 3. Verify
      notify({
        step: 'verifying',
        percent: 96,
        message: 'Verificando y probando motores multimedia...'
      });

      this.invalidateCache();
      const finalStatus = this.getStatus(true);
      if (!finalStatus.ready) {
        throw new Error('La instalación finalizó pero el motor yt-dlp no respondió.');
      }

      notify({
        step: 'completed',
        percent: 100,
        message: '¡Todo listo! Vortex está configurado con éxito.'
      });

      return finalStatus;
    } catch (err: any) {
      notify({
        step: 'error',
        percent: 0,
        message: 'Error durante la instalación automática',
        error: err.message || 'Error desconocido al configurar binarios'
      });
      throw err;
    }
  }
}
