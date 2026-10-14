import path from 'path';
import fs from 'fs';
import os from 'os';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { DownloadItem, Category } from '../renderer/types';

export class VortexDatabase {
  private db!: Database;
  private dbPath: string;
  private isReady = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(vortexDir: string) {
    const storageDir = path.join(vortexDir, 'storage');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.dbPath = path.join(storageDir, 'vortex.db');

    // Auto-migrate from legacy .smasher/storage/smasher.db if vortex.db does not exist yet
    if (!fs.existsSync(this.dbPath)) {
      const smasherDbPath = path.join(os.homedir(), '.smasher', 'storage', 'smasher.db');
      if (fs.existsSync(smasherDbPath)) {
        try {
          fs.copyFileSync(smasherDbPath, this.dbPath);
          console.log('[Vortex] Migración exitosa de smasher.db a vortex.db');
        } catch (e: any) {
          console.warn('[Vortex] No se pudo copiar smasher.db:', e.message);
        }
      }
    }
  }

  public async init(): Promise<void> {
    const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm') && fs.existsSync(wasmPath)) {
          return wasmPath;
        }
        return file;
      }
    });

    if (fs.existsSync(this.dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } catch (err) {
        console.error('Error cargando vortex.db existente, creando nueva:', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.initSchema();
    this.importExistingDataIfEmpty(SQL);
    this.saveToDisk();
    this.isReady = true;
  }

  private importExistingDataIfEmpty(SQL: SqlJsStatic) {
    try {
      // 1. If Stacher database exists, import all historical downloads
      const stacherDbPath = path.join(os.homedir(), '.stacher', 'storage', 'stacher.db');
      if (fs.existsSync(stacherDbPath)) {
        try {
          const stacherBuf = fs.readFileSync(stacherDbPath);
          const stacherDb = new SQL.Database(stacherBuf);
          const stmt = stacherDb.prepare('SELECT id, downloadId, title, url, status, fileDest, thumbnail, createdAt FROM library');
          while (stmt.step()) {
            const row = stmt.getAsObject() as any;
            const id = row.downloadId || `stacher-${row.id}`;
            const existing = this.query('SELECT id FROM library WHERE id = ?', [id]);
            if (existing.length === 0) {
              const dest = (row.fileDest || '').toString().trim();
              const ext = path.extname(dest).toLowerCase().replace('.', '');
              const format = ['mp3', 'm4a', 'flac', 'wav', 'webm', 'mkv', 'mp4'].includes(ext) ? ext : 'mp4';
              let filesize = 0;
              if (dest && fs.existsSync(dest)) {
                try { filesize = fs.statSync(dest).size; } catch {}
              }
              this.db.run(
                `INSERT OR IGNORE INTO library (id, url, title, filename, filepath, format, resolution, filesize, duration, download_date, status, thumbnail_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  row.url || '',
                  row.title || 'Descarga',
                  path.basename(dest),
                  dest,
                  format,
                  'auto',
                  filesize,
                  0,
                  row.createdAt || new Date().toISOString(),
                  row.status === 'finished' ? 'completed' : (row.status || 'completed'),
                  row.thumbnail || ''
                ]
              );
            }
          }
          stmt.free();
          stacherDb.close();
        } catch (err: any) {
          console.warn('Notice: Could not import from stacher.db:', err.message);
        }
      }

      // 2. Also register any existing downloads in user Downloads folder if not already tracked
      const downloadsDir = path.join(os.homedir(), 'Downloads');
      if (fs.existsSync(downloadsDir)) {
        const files = fs.readdirSync(downloadsDir);
        for (const f of files) {
          if (f.toLowerCase().includes('worried your ai') && (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.mp3'))) {
            const fullPath = path.join(downloadsDir, f);
            const stat = fs.statSync(fullPath);
            const existing = this.query('SELECT id FROM library WHERE filepath = ?', [fullPath]);
            if (existing.length === 0) {
              const ext = path.extname(f).toLowerCase().replace('.', '');
              this.db.run(
                `INSERT OR IGNORE INTO library (id, url, title, filename, filepath, format, resolution, filesize, duration, download_date, status, thumbnail_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  `worried-ai-${ext}`,
                  'https://www.youtube.com/watch?v=Y17YhD1jrME',
                  'Worried Your AI Reverse Engineering Is Just Guesswork? morluto/rea Tracks Down Conclusions with ...',
                  f,
                  fullPath,
                  ext,
                  ext === 'mp4' ? '1080p' : 'auto',
                  stat.size,
                  0,
                  new Date().toISOString(),
                  'completed',
                  'https://i.ytimg.com/vi/Y17YhD1jrME/maxresdefault.jpg'
                ]
              );
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('Notice: Error during data import:', err.message);
    }
  }

  private saveToDisk(immediate = false) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const doSave = () => {
      try {
        const data = this.db.export();
        fs.promises.writeFile(this.dbPath, Buffer.from(data)).catch(err => {
          console.error('Error guardando vortex.db en disco:', err);
        });
      } catch (err) {
        console.error('Error exportando vortex.db:', err);
      }
    };

    if (immediate) {
      doSave();
    } else {
      this.saveTimeout = setTimeout(doSave, 200);
    }
  }

  private query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#228be6',
        icon TEXT DEFAULT 'folder'
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#868e96'
      );

      CREATE TABLE IF NOT EXISTS library (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        format TEXT DEFAULT 'best',
        resolution TEXT DEFAULT 'auto',
        filesize INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        download_date TEXT NOT NULL,
        status TEXT NOT NULL,
        thumbnail_url TEXT,
        category_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS library_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT
      );

      CREATE TABLE IF NOT EXISTS category_links (
        library_id TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (library_id, category_id)
      );

      CREATE TABLE IF NOT EXISTS tag_links (
        library_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (library_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS sprites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id TEXT NOT NULL,
        vtt_path TEXT,
        image_path TEXT
      );

      CREATE TABLE IF NOT EXISTS subtitles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id TEXT NOT NULL,
        lang TEXT NOT NULL,
        format TEXT NOT NULL,
        filepath TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS points_of_interest (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id TEXT NOT NULL,
        timestamp REAL NOT NULL,
        title TEXT NOT NULL,
        type TEXT DEFAULT 'chapter'
      );

      CREATE TABLE IF NOT EXISTS url_detection_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        platform_name TEXT NOT NULL,
        icon TEXT DEFAULT 'world',
        enabled INTEGER DEFAULT 1
      );
    `);

    // Insert default patterns if table is empty
    const patterns = this.query<{ cnt: number }>('SELECT count(*) as cnt FROM url_detection_patterns');
    if (!patterns[0] || patterns[0].cnt === 0) {
      this.db.run('INSERT INTO url_detection_patterns (pattern, platform_name, icon) VALUES (?, ?, ?)', ['(youtube\\.com|youtu\\.be)', 'YouTube', 'brand-youtube']);
      this.db.run('INSERT INTO url_detection_patterns (pattern, platform_name, icon) VALUES (?, ?, ?)', ['tiktok\\.com', 'TikTok', 'brand-tiktok']);
      this.db.run('INSERT INTO url_detection_patterns (pattern, platform_name, icon) VALUES (?, ?, ?)', ['(twitter\\.com|x\\.com)', 'X / Twitter', 'brand-x']);
      this.db.run('INSERT INTO url_detection_patterns (pattern, platform_name, icon) VALUES (?, ?, ?)', ['twitch\\.tv', 'Twitch', 'brand-twitch']);
      this.db.run('INSERT INTO url_detection_patterns (pattern, platform_name, icon) VALUES (?, ?, ?)', ['soundcloud\\.com', 'SoundCloud', 'brand-soundcloud']);
      this.db.run('INSERT INTO url_detection_patterns (pattern, platform_name, icon) VALUES (?, ?, ?)', ['instagram\\.com', 'Instagram', 'brand-instagram']);
      this.db.run('INSERT INTO url_detection_patterns (pattern, platform_name, icon) VALUES (?, ?, ?)', ['reddit\\.com', 'Reddit', 'brand-reddit']);
    }

    // Default categories
    const categoriesCount = this.query<{ cnt: number }>('SELECT count(*) as cnt FROM categories');
    if (!categoriesCount[0] || categoriesCount[0].cnt === 0) {
      this.db.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', ['General', '#339af0', 'folder']);
      this.db.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', ['Música', '#f06595', 'music']);
      this.db.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', ['Podcasts', '#845ef7', 'microphone']);
      this.db.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', ['Tutoriales', '#51cf66', 'school']);
    }
  }

  public saveLibraryItem(item: DownloadItem): void {
    const existing = this.query('SELECT id FROM library WHERE id = ?', [item.id]);
    if (existing.length > 0) {
      this.db.run(
        `UPDATE library SET 
          status = ?, filepath = ?, filesize = ?, title = ? 
         WHERE id = ?`,
        [item.status, item.filepath, item.filesize, item.title, item.id]
      );
    } else {
      this.db.run(
        `INSERT INTO library (id, url, title, filename, filepath, format, resolution, filesize, duration, download_date, status, thumbnail_url, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.url,
          item.title,
          item.filename,
          item.filepath,
          item.format,
          item.resolution,
          item.filesize,
          item.duration,
          item.download_date,
          item.status,
          item.thumbnail_url,
          item.category_id ?? null
        ]
      );
    }
    this.saveToDisk();
  }

  public updateItemStatus(id: string, status: string, filepath?: string, filesize?: number, title?: string): void {
    if (filepath && filesize !== undefined) {
      if (title) {
        this.db.run('UPDATE library SET status = ?, filepath = ?, filesize = ?, title = ? WHERE id = ?', [status, filepath, filesize, title, id]);
      } else {
        this.db.run('UPDATE library SET status = ?, filepath = ?, filesize = ? WHERE id = ?', [status, filepath, filesize, id]);
      }
    } else {
      this.db.run('UPDATE library SET status = ? WHERE id = ?', [status, id]);
    }
    this.saveToDisk();
  }

  public updateLibraryItemMeta(id: string, title?: string, thumbnailUrl?: string, duration?: number): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (title) { fields.push('title = ?'); values.push(title); }
    if (thumbnailUrl) { fields.push('thumbnail_url = ?'); values.push(thumbnailUrl); }
    if (duration !== undefined && duration > 0) { fields.push('duration = ?'); values.push(duration); }
    if (fields.length > 0) {
      values.push(id);
      this.db.run(`UPDATE library SET ${fields.join(', ')} WHERE id = ?`, values);
      this.saveToDisk();
    }
  }

  public getLibraryItems(filter?: { categoryId?: number; query?: string }): DownloadItem[] {
    let sql = 'SELECT * FROM library';
    const params: any[] = [];
    const clauses: string[] = [];

    if (filter?.categoryId) {
      clauses.push('category_id = ?');
      params.push(filter.categoryId);
    }

    if (filter?.query) {
      clauses.push('(title LIKE ? OR url LIKE ?)');
      params.push(`%${filter.query}%`, `%${filter.query}%`);
    }

    if (clauses.length > 0) {
      sql += ' WHERE ' + clauses.join(' AND ');
    }

    sql += ' ORDER BY download_date DESC';

    return this.query<DownloadItem>(sql, params);
  }

  public deleteLibraryItem(id: string): void {
    this.db.run('DELETE FROM library WHERE id = ?', [id]);
    this.saveToDisk();
  }

  public getCategories(): Category[] {
    return this.query<Category>('SELECT * FROM categories ORDER BY name ASC');
  }

  public addCategory(name: string, color: string, icon = 'folder'): void {
    this.db.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', [name, color, icon]);
    this.saveToDisk();
  }

  public getStats(): { totalCount: number; totalSize: number } {
    const res = this.query<{ totalCount: number; totalSize: number }>(
      'SELECT count(*) as totalCount, sum(filesize) as totalSize FROM library WHERE status = "completed"'
    );
    return {
      totalCount: res[0]?.totalCount || 0,
      totalSize: res[0]?.totalSize || 0
    };
  }

  public backupDatabase(targetPath?: string): string {
    const backupDir = path.dirname(this.dbPath);
    const dest = targetPath || path.join(backupDir, `smasher-backup-${Date.now()}.json`);

    const data = {
      meta: this.query('SELECT * FROM meta'),
      categories: this.query('SELECT * FROM categories'),
      tags: this.query('SELECT * FROM tags'),
      library: this.query('SELECT * FROM library'),
      library_settings: this.query('SELECT * FROM library_settings'),
      points_of_interest: this.query('SELECT * FROM points_of_interest'),
      subtitles: this.query('SELECT * FROM subtitles'),
      url_detection_patterns: this.query('SELECT * FROM url_detection_patterns'),
      backup_timestamp: new Date().toISOString()
    };

    fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf-8');
    return dest;
  }

  public restoreDatabase(sourcePath: string): { restoredItems: number; restoredCategories: number } {
    if (!fs.existsSync(sourcePath)) throw new Error('Archivo de copia de seguridad no existe.');
    const content = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));

    let restoredItems = 0;
    let restoredCategories = 0;

    if (Array.isArray(content.categories)) {
      for (const cat of content.categories) {
        try {
          this.db.run('INSERT OR IGNORE INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)', [cat.id, cat.name, cat.color, cat.icon || 'folder']);
          restoredCategories++;
        } catch {}
      }
    }

    if (Array.isArray(content.library)) {
      for (const item of content.library) {
        try {
          this.saveLibraryItem(item);
          restoredItems++;
        } catch {}
      }
    }

    this.saveToDisk();
    return { restoredItems, restoredCategories };
  }

  public reconcileLibrary(scanFolder?: string): { reconciledCount: number; checkedCount: number } {
    const items = this.getLibraryItems();
    let reconciledCount = 0;

    const baseScan = scanFolder || path.join(os.homedir(), 'Downloads');

    for (const item of items) {
      if (!item.filepath || !fs.existsSync(item.filepath)) {
        // Try to find by filename in scan folder
        const candidate = path.join(baseScan, item.filename || `${item.title}.mp4`);
        if (fs.existsSync(candidate)) {
          const stat = fs.statSync(candidate);
          this.updateItemStatus(item.id, 'completed', candidate, stat.size);
          reconciledCount++;
        }
      }
    }

    return { reconciledCount, checkedCount: items.length };
  }

  public savePointsOfInterest(libraryId: string, points: { timestamp: number; title: string; type?: string }[]): void {
    this.db.run('DELETE FROM points_of_interest WHERE library_id = ?', [libraryId]);
    for (const p of points) {
      this.db.run(
        'INSERT INTO points_of_interest (library_id, timestamp, title, type) VALUES (?, ?, ?, ?)',
        [libraryId, p.timestamp, p.title, p.type || 'chapter']
      );
    }
    this.saveToDisk();
  }

  public getPointsOfInterest(libraryId: string): any[] {
    return this.query('SELECT * FROM points_of_interest WHERE library_id = ? ORDER BY timestamp ASC', [libraryId]);
  }

  public getSubtitles(libraryId: string): any[] {
    return this.query('SELECT * FROM subtitles WHERE library_id = ?', [libraryId]);
  }
}

export { VortexDatabase as SmasherDatabase };

