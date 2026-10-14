import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import treeKill from 'tree-kill';
import { BinaryManager } from './binary-manager';
import { DownloadOptions, DownloadProgress, VideoMetadata } from '../renderer/types';

export class VortexDownloader {
  private binaryManager: BinaryManager;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private onProgressCallback?: (progress: DownloadProgress) => void;

  constructor(binaryManager: BinaryManager) {
    this.binaryManager = binaryManager;
  }

  public setProgressCallback(cb: (progress: DownloadProgress) => void) {
    this.onProgressCallback = cb;
  }

  public async fetchMetadata(url: string): Promise<VideoMetadata> {
    const ytdlp = this.binaryManager.findBinary('yt-dlp');
    if (!ytdlp) throw new Error('yt-dlp no está instalado o no se encuentra.');

    const args = ['--dump-json', '--no-playlist', url];
    const deno = this.binaryManager.findBinary('deno');
    if (deno) {
      args.unshift(`--js-runtimes`, `deno:${deno}`);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(ytdlp, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', chunk => { stdout += chunk.toString('utf-8'); });
      proc.stderr.on('data', chunk => { stderr += chunk.toString('utf-8'); });

      proc.on('close', code => {
        if (code !== 0) {
          return reject(new Error(`Error obteniendo metadatos (${code}): ${stderr || 'Fallo desconocido'}`));
        }
        try {
          const data = JSON.parse(stdout);
          resolve({
            id: data.id || '',
            title: data.title || 'Sin título',
            url: data.webpage_url || url,
            duration: data.duration || 0,
            thumbnail: data.thumbnail || '',
            uploader: data.uploader || data.channel || 'Desconocido',
            description: data.description?.slice(0, 300),
            formats: (data.formats || []).map((f: any) => ({
              format_id: f.format_id,
              ext: f.ext,
              resolution: f.resolution || `${f.width || 0}x${f.height || 0}`,
              filesize: f.filesize || f.filesize_approx,
              vcodec: f.vcodec,
              acodec: f.acodec,
              fps: f.fps
            })),
            chapters: (data.chapters || []).map((c: any) => ({
              start_time: c.start_time || 0,
              end_time: c.end_time || 0,
              title: c.title || 'Capítulo'
            }))
          });
        } catch (e: any) {
          reject(new Error(`Error parseando respuesta JSON: ${e.message}`));
        }
      });
    });
  }

  public startDownload(
    id: string,
    options: DownloadOptions,
    onComplete: (filepath: string, filesize: number, title?: string) => void,
    onError: (err: Error) => void
  ): void {
    const ytdlp = this.binaryManager.findBinary('yt-dlp');
    if (!ytdlp) return onError(new Error('yt-dlp no disponible'));

    const ffmpeg = this.binaryManager.findBinary('ffmpeg');
    const deno = this.binaryManager.findBinary('deno');
    const destDir = options.downloadDir || path.join(os.homedir(), 'Downloads');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const outputTemplate = path.join(destDir, '%(title)s [%(id)s].%(ext)s');
    const args: string[] = ['--newline', '--progress', '--no-mtime', '-o', outputTemplate, '--print', 'after_move:filepath'];

    if (ffmpeg) {
      args.push('--ffmpeg-location', path.dirname(ffmpeg));
    }

    if (deno) {
      args.push('--js-runtimes', `deno:${deno}`);
    }

    // Format selection: Audio vs Video
    const isAudioOnly = options.extractAudioOnly || options.mediaType === 'audio' || ['mp3', 'flac', 'opus', 'm4a', 'wav'].includes(options.formatPreset);

    if (isAudioOnly) {
      const audioFmt = options.audioFormat || (['mp3', 'flac', 'opus', 'm4a', 'wav'].includes(options.formatPreset) ? options.formatPreset : 'mp3');
      args.push('-x', '--audio-format', audioFmt);
      if (audioFmt === 'mp3') {
        args.push('--audio-quality', '0');
      }
    } else {
      // Video mode: ensure compatible MP4 or requested container
      const container = options.videoContainer || (['mkv', 'webm', 'mp4'].includes(options.formatPreset) ? options.formatPreset : 'mp4');
      const res = options.videoResolution || (['4k', '1440p', '1080p', '720p', '480p'].includes(options.formatPreset) ? options.formatPreset : 'best');

      let heightFilter = '';
      if (res === '4k') heightFilter = '[height<=2160]';
      else if (res === '1440p') heightFilter = '[height<=1440]';
      else if (res === '1080p') heightFilter = '[height<=1080]';
      else if (res === '720p') heightFilter = '[height<=720]';
      else if (res === '480p') heightFilter = '[height<=480]';

      if (container === 'mp4') {
        if (heightFilter) {
          args.push('-f', `bestvideo${heightFilter}[ext=mp4]+bestaudio[ext=m4a]/bestvideo${heightFilter}+bestaudio/best${heightFilter}/best`);
        } else {
          args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best');
        }
        args.push('--merge-output-format', 'mp4');
        args.push('--remux-video', 'mp4');
      } else if (container === 'mkv') {
        if (heightFilter) {
          args.push('-f', `bestvideo${heightFilter}+bestaudio/best${heightFilter}/best`);
        } else {
          args.push('-f', 'bestvideo+bestaudio/best');
        }
        args.push('--merge-output-format', 'mkv');
      } else if (container === 'webm') {
        if (heightFilter) {
          args.push('-f', `bestvideo${heightFilter}[ext=webm]+bestaudio[ext=webm]/bestvideo${heightFilter}+bestaudio/best${heightFilter}/best`);
        } else {
          args.push('-f', 'bestvideo+bestaudio/best');
        }
        args.push('--merge-output-format', 'webm');
      }
    }

    // SponsorBlock support (Native & 100% Free!)
    if (options.enableSponsorblock) {
      args.push('--sponsorblock-remove', 'default');
    }

    // Browser Cookies support
    if (options.browserCookies && options.browserCookies !== 'none') {
      args.push('--cookies-from-browser', options.browserCookies);
    }

    // Extras
    if (options.embedThumbnail) {
      args.push('--embed-thumbnail');
    }
    if (options.embedSubtitles) {
      args.push('--embed-subs', '--sub-langs', 'all');
    }

    args.push(options.url);

    const proc = spawn(ytdlp, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    this.activeProcesses.set(id, proc);

    let downloadedFile = '';

    proc.stdout.on('data', chunk => {
      const text = chunk.toString('utf-8');
      
      const lines = text.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Exact after_move:filepath output or Windows path
        const winPathMatch = line.match(/^([A-Za-z]:\\[^\r\n]+?\.[A-Za-z0-9]{2,5})$/);
        if (winPathMatch) {
          downloadedFile = winPathMatch[1].trim();
        }

        // Look for Merger destination or standard destination
        const mergeMatch = line.match(/(?:Merging formats into|Destination:)\s+["']?([^"'\r\n]+)/i);
        if (mergeMatch && mergeMatch[1]) {
          const candidate = mergeMatch[1].trim().replace(/["']/g, '');
          downloadedFile = candidate;
        }

        // Look for already downloaded
        const alreadyMatch = line.match(/\[download\]\s+(.+)\s+has already been downloaded/i);
        if (alreadyMatch && alreadyMatch[1]) {
          downloadedFile = alreadyMatch[1].trim();
        }

        // Parse progress: [download]   6.9% of  218.53KiB at    3.66MiB/s ETA 00:00
        const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?([\w.]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
        if (progressMatch && this.onProgressCallback) {
          this.onProgressCallback({
            id,
            status: 'downloading',
            percent: parseFloat(progressMatch[1]),
            totalSize: progressMatch[2],
            speed: progressMatch[3],
            eta: progressMatch[4],
            downloadedSize: ''
          });
        }

        // Parse 100% completion line
        const finishMatch = line.match(/\[download\]\s+100%\s+of\s+~?([\w.]+)/i);
        if (finishMatch && this.onProgressCallback) {
          this.onProgressCallback({
            id,
            status: 'downloading',
            percent: 100,
            totalSize: finishMatch[1],
            speed: 'Completado',
            eta: '00:00',
            downloadedSize: finishMatch[1]
          });
        }
      }
    });

    let stderr = '';
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString('utf-8');
    });

    proc.on('close', code => {
      this.activeProcesses.delete(id);

      if (code === 0) {
        let size = 0;

        if (downloadedFile && !path.isAbsolute(downloadedFile)) {
          downloadedFile = path.resolve(destDir, downloadedFile);
        }

        // If downloadedFile is not found or was temporary, locate newest file in destDir
        if (!downloadedFile || !fs.existsSync(downloadedFile)) {
          try {
            const files = fs.readdirSync(destDir).map(f => path.join(destDir, f));
            const recent = files
              .filter(f => fs.existsSync(f) && fs.statSync(f).isFile() && !f.endsWith('.part') && !f.endsWith('.ytdl'))
              .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
            if (recent.length > 0 && (Date.now() - fs.statSync(recent[0]).mtimeMs < 600000)) {
              downloadedFile = recent[0];
            }
          } catch (e) {
            console.error('Error finding recent file in destDir:', e);
          }
        }

        let computedTitle: string | undefined = undefined;
        if (downloadedFile && fs.existsSync(downloadedFile)) {
          size = fs.statSync(downloadedFile).size;
          const base = path.basename(downloadedFile, path.extname(downloadedFile));
          computedTitle = base.replace(/\s*\[[a-zA-Z0-9_-]{11}\]$/, '');
        }

        if (this.onProgressCallback) {
          this.onProgressCallback({
            id,
            status: 'completed',
            percent: 100,
            speed: '',
            eta: '',
            totalSize: '',
            downloadedSize: ''
          });
        }
        onComplete(downloadedFile, size, computedTitle);
      } else {
        console.error('yt-dlp download failed with code', code, stderr);
        if (this.onProgressCallback) {
          this.onProgressCallback({
            id,
            status: 'error',
            percent: 0,
            speed: '',
            eta: '',
            totalSize: '',
            downloadedSize: '',
            error: stderr || `Exit code ${code}`
          });
        }
        onError(new Error(stderr || `Error ${code}`));
      }
    });
  }

  public cancelDownload(id: string): boolean {
    const proc = this.activeProcesses.get(id);
    if (proc && proc.pid) {
      try {
        treeKill(proc.pid, 'SIGKILL');
        this.activeProcesses.delete(id);
        if (this.onProgressCallback) {
          this.onProgressCallback({
            id,
            status: 'cancelled',
            percent: 0,
            speed: '',
            eta: '',
            totalSize: '',
            downloadedSize: ''
          });
        }
        return true;
      } catch (e) {
        console.error('Error killing process:', e);
      }
    }
    return false;
  }
}

export { VortexDownloader as SmasherDownloader };
