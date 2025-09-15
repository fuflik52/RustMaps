import * as fs from 'fs-extra';
import * as path from 'path';
import { MapData } from '../types';
import { logger } from '../utils/logger';

export interface CacheData {
  discoveredMaps: MapData[];
  downloadedFileUrls: string[]; // массив URL скачанных файлов карт
  lastScanDate: string;
  totalMapsFound: number;
  totalFilesDownloaded: number;
}

export class CacheManager {
  private cacheFilePath: string;
  private outputDir: string;
  private cache: CacheData;

  constructor(outputDir: string = './output') {
    this.outputDir = outputDir;
    this.cacheFilePath = path.join(outputDir, 'rustmaps-cache.json');
    this.cache = {
      discoveredMaps: [],
      downloadedFileUrls: [],
      lastScanDate: '',
      totalMapsFound: 0,
      totalFilesDownloaded: 0
    };
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.outputDir);
    await this.loadCache();
  }

  private async loadCache(): Promise<void> {
    try {
      if (await fs.pathExists(this.cacheFilePath)) {
        const cacheContent = await fs.readJson(this.cacheFilePath);
        this.cache = { ...this.cache, ...cacheContent };
        logger.info(`Cache loaded: found ${this.cache.totalMapsFound} maps, downloaded ${this.cache.totalFilesDownloaded} files`);
      } else {
        logger.info('Cache not found, creating new one');
      }
    } catch (error) {
      logger.error('Error loading cache', error as Error);
      // Use empty cache in case of error
    }
  }

  async saveCache(): Promise<void> {
    try {
      await fs.writeJson(this.cacheFilePath, this.cache, { spaces: 2 });
      logger.debug('Cache saved');
    } catch (error) {
      logger.error('Error saving cache', error as Error);
    }
  }

  // Updates list of discovered maps
  async updateDiscoveredMaps(maps: MapData[]): Promise<void> {
    // Merge new maps with existing ones, avoiding duplicates
    const existingMids = new Set(this.cache.discoveredMaps.map(m => m.mid));
    const newMaps = maps.filter(map => !existingMids.has(map.mid));
    
    this.cache.discoveredMaps.push(...newMaps);
    this.cache.totalMapsFound = this.cache.discoveredMaps.length;
    this.cache.lastScanDate = new Date().toISOString();

    if (newMaps.length > 0) {
      logger.info(`Added ${newMaps.length} new maps to cache`);
    }

    await this.saveCache();
  }

  // Marks file as downloaded
  async markFileAsDownloaded(fileUrl: string): Promise<void> {
    if (!this.cache.downloadedFileUrls.includes(fileUrl)) {
      this.cache.downloadedFileUrls.push(fileUrl);
      this.cache.totalFilesDownloaded = this.cache.downloadedFileUrls.length;
      logger.debug(`File marked as downloaded: ${fileUrl}`);
      await this.saveCache();
    }
  }

  // Checks if file was already downloaded
  isFileAlreadyDownloaded(fileUrl: string): boolean {
    return this.cache.downloadedFileUrls.includes(fileUrl);
  }

  // Returns maps with new files that haven't been downloaded yet
  getMapsWithNewFiles(): MapData[] {
    return this.cache.discoveredMaps.filter(map => {
      if (!map.mapFiles || map.mapFiles.length === 0) {
        return false; // Skip maps without files
      }
      
      // Check if there are new files in the map
      return map.mapFiles.some(file => 
        file.downloadUrl && !this.isFileAlreadyDownloaded(file.downloadUrl)
      );
    });
  }

  // Returns all discovered maps
  getAllDiscoveredMaps(): MapData[] {
    return this.cache.discoveredMaps;
  }

  // Returns statistics
  getStats(): {
    totalFound: number;
    totalDownloaded: number;
    remaining: number;
    lastScan: string;
  } {
    const mapsWithNewFiles = this.getMapsWithNewFiles();
    return {
      totalFound: this.cache.totalMapsFound,
      totalDownloaded: this.cache.totalFilesDownloaded,
      remaining: mapsWithNewFiles.length,
      lastScan: this.cache.lastScanDate
    };
  }

  // Resets list of downloaded files (for debugging)
  async resetDownloadedFiles(): Promise<void> {
    this.cache.downloadedFileUrls = [];
    this.cache.totalFilesDownloaded = 0;
    await this.saveCache();
    logger.info('Downloaded files list reset');
  }

  // Checks if map file exists physically
  async verifyDownloadedFile(mapData: MapData): Promise<boolean> {
    try {
      const filename = this.generateFilename(mapData);
      const filepath = path.join(this.outputDir, filename);
      
      if (await fs.pathExists(filepath)) {
        const stats = await fs.stat(filepath);
        return stats.size > 0;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Synchronizes cache with actually downloaded files
  async syncWithFileSystem(): Promise<void> {
    logger.info('Syncing cache with file system...');
    
    const reallyDownloadedUrls: string[] = [];
    
    for (const map of this.cache.discoveredMaps) {
      if (map.mapFiles) {
        for (const file of map.mapFiles) {
          if (file.downloadUrl && await this.verifyDownloadedFile(map)) {
            reallyDownloadedUrls.push(file.downloadUrl);
          }
        }
      }
    }
    
    const previousCount = this.cache.downloadedFileUrls.length;
    this.cache.downloadedFileUrls = reallyDownloadedUrls;
    this.cache.totalFilesDownloaded = reallyDownloadedUrls.length;
    
    await this.saveCache();
    
    const difference = reallyDownloadedUrls.length - previousCount;
    if (difference !== 0) {
      logger.info(`Sync completed: ${difference > 0 ? '+' : ''}${difference} files`);
    }
  }

  private generateFilename(mapData: MapData): string {
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sanitizedTitle = sanitize(mapData.title).substring(0, 50);
    return `${mapData.mid}_${sanitizedTitle}.map`;
  }
} 