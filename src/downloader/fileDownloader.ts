import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { MapData, DownloadProgress, DownloadError } from '../types';
import { logger } from '../utils/logger';
import { DEFAULT_CONFIG } from '../config/defaults';
import sanitize from 'sanitize-filename';
import pLimit from 'p-limit';
import { CacheManager } from '../core/cacheManager';

export class FileDownloader {
  private outputDir: string;
  private concurrencyLimit: any;
  private userAgent: string;
  private timeout: number;
  private retryAttempts: number;
  private cacheManager: CacheManager;

  constructor(
    outputDir: string = DEFAULT_CONFIG.outputDir,
    concurrency: number = DEFAULT_CONFIG.concurrency,
    retryAttempts: number = DEFAULT_CONFIG.retryAttempts
  ) {
    this.outputDir = outputDir;
    this.concurrencyLimit = pLimit(concurrency);
    this.userAgent = DEFAULT_CONFIG.userAgent;
    this.timeout = DEFAULT_CONFIG.timeout;
    this.retryAttempts = retryAttempts;
    this.cacheManager = new CacheManager(outputDir);
  }

  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.outputDir);
      await this.cacheManager.initialize();
      logger.success(`Download directory created: ${this.outputDir}`);
    } catch (error) {
      logger.error('Error creating directory', error as Error);
      throw error;
    }
  }

  private getFilename(mapData: MapData, url: string): string {
    const urlParts = new URL(url);
    const filename = urlParts.pathname.split('/').pop() || '';
    
    if (filename && filename.includes('.')) {
      let sanitizedTitle = sanitize(mapData.title).substring(0, 50);
      const extension = path.extname(filename);
      
      // Если title уже содержит расширение, убираем его
      if (sanitizedTitle.toLowerCase().endsWith(extension.toLowerCase())) {
        sanitizedTitle = sanitizedTitle.slice(0, -extension.length);
      }
      
      return `${mapData.mid}_${sanitizedTitle}${extension}`;
    }
    
    return `${mapData.mid}_${sanitize(mapData.title)}.map`;
  }

  private async downloadWithRetry(
    url: string,
    filepath: string,
    mapData: MapData,
    attempt: number = 1
  ): Promise<boolean> {
    try {
      logger.debug(`Attempt ${attempt}: downloading ${mapData.title}`);

      const response: AxiosResponse = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': '*/*',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        maxRedirects: 5
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      let lastLoggedProgress = -1; // Initialize with a value that will trigger the first log

      const writer = fs.createWriteStream(filepath);
      
      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        
        if (totalSize > 0) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          if (progress >= lastLoggedProgress + 5 || progress === 100) { // Log every 5% or at 100%
            process.stdout.write(
              `\r${mapData.title}: ${progress}% (${this.formatBytes(downloadedSize)}/${this.formatBytes(totalSize)})`
            );
            lastLoggedProgress = progress;
          }
        }
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          process.stdout.write('\n');
          logger.success(`Downloaded: ${mapData.title} (${this.formatBytes(downloadedSize)})`);
          resolve(true);
        });

        writer.on('error', (error) => {
          fs.remove(filepath).catch(() => {});
          reject(error);
        });

        response.data.on('error', (error: Error) => {
          fs.remove(filepath).catch(() => {});
          reject(error);
        });
      });

    } catch (error) {
      logger.debug(`Download error (attempt ${attempt}): ${(error as Error).message}`);
      
      // Remove partially downloaded file
      try {
        await fs.remove(filepath);
      } catch {}

      if (attempt < this.retryAttempts) {
        logger.debug(`Retrying in 5 seconds...`);
        await this.delay(5000);
        return this.downloadWithRetry(url, filepath, mapData, attempt + 1);
      }

      throw new DownloadError(
        `Failed to download after ${this.retryAttempts} attempts: ${(error as Error).message}`,
        'DOWNLOAD_FAILED',
        mapData.mid
      );
    }
  }

  async downloadMap(mapData: MapData): Promise<boolean> {
    return this.concurrencyLimit(async () => {
      if (!mapData.downloadUrl) {
        logger.warn(`No download link: ${mapData.title}`);
        return false;
      }

      // Check cache - was this file already downloaded
      if (this.cacheManager.isFileAlreadyDownloaded(mapData.downloadUrl)) {
        logger.debug(`File already downloaded (from cache): ${mapData.downloadUrl.split('/').pop()}`);
        return true;
      }

      const filename = this.getFilename(mapData, mapData.downloadUrl);
      const filepath = path.join(this.outputDir, filename);

      // Check if file is already downloaded physically
      if (await fs.pathExists(filepath)) {
        const stats = await fs.stat(filepath);
        if (stats.size > 0) {
          logger.debug(`File already exists: ${filename}`);
          // Mark as downloaded in cache
          await this.cacheManager.markFileAsDownloaded(mapData.downloadUrl);
          return true;
        }
      }

      try {
        const success = await this.downloadWithRetry(mapData.downloadUrl, filepath, mapData);
        if (success) {
          // Mark as downloaded in cache
          await this.cacheManager.markFileAsDownloaded(mapData.downloadUrl);
        }
        return success;
      } catch (error) {
        logger.error(`Download error ${mapData.title}`, error as Error);
        return false;
      }
    });
  }

  async downloadAllMaps(maps: MapData[]): Promise<{ success: number; failed: number }> {
    logger.info(`Starting download of ${maps.length} maps...`);
    
    const validMaps = maps.filter(map => map.downloadUrl);
    logger.info(`Maps with valid links: ${validMaps.length}`);

    const results = await Promise.all(
      validMaps.map(map => this.downloadMap(map))
    );

    const success = results.filter(Boolean).length;
    const failed = results.length - success;

    logger.divider();
    logger.success('Download completed:');
    logger.info(`  ✅ Success: ${success}`);
    logger.info(`  ❌ Errors: ${failed}`);
    logger.info(`  📁 Folder: ${this.outputDir}`);
    logger.divider();

    return { success, failed };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createManifest(maps: MapData[]): Promise<void> {
    try {
      const manifestPath = path.join(this.outputDir, 'maps_manifest.json');
      
      const manifest = {
        generatedAt: new Date().toISOString(),
        totalMaps: maps.length,
        maps: maps.map(map => ({
          id: map.mid,
          title: map.title,
          url: map.url,
          downloadUrl: map.downloadUrl,
          facepunchUrl: map.facepunchUrl,
          tags: map.tags,
          files: map.mapFiles?.map(file => ({
            name: file.name,
            size: file.size,
            downloadUrl: file.downloadUrl
          }))
        }))
      };
      
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      logger.success(`Manifest created: ${manifestPath}`);
      
    } catch (error) {
      logger.error('Error creating manifest:', error as Error);
    }
  }

  // Методы для работы с кешем
  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  // Метод больше не нужен - логика перенесена в index.ts

  async getCacheStats() {
    return this.cacheManager.getStats();
  }

  async syncCacheWithFileSystem(): Promise<void> {
    logger.debug('Syncing cache with file system...');
    
    try {
      const files = await fs.readdir(this.outputDir);
      const mapFiles = files.filter(f => f.endsWith('.map'));
      
      logger.debug(`Found ${mapFiles.length} .map files on disk`);
      
      // Here we could implement logic to sync cache with actual files
      // For now, we just log the count
      
    } catch (error) {
      logger.debug('Error syncing cache with file system:', error as Error);
    }
  }

  async resetDownloadCache(): Promise<void> {
    await this.cacheManager.resetDownloadedFiles();
    logger.info('Download cache reset');
  }
} 