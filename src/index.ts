#!/usr/bin/env node

import { Command } from 'commander';
import { BrowserManager } from './core/browser';
import { MapParser } from './parsers/mapParser';
import { FileDownloader } from './downloader/fileDownloader';
import { logger, LogLevel } from './utils/logger';
import { CacheManager } from './core/cacheManager';
import { DEFAULT_CONFIG } from './config/defaults';
import { WEBHOOK_CONFIG, FACEPUNCH_CONFIG } from './config';
import { DiscordWebhook } from './discord/webhook';
import { FacepunchUploader } from './uploader/facepunchUploader';
import { MapData } from './types';
import sanitize from 'sanitize-filename';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import * as path from 'path';

// Загружаем переменные окружения
dotenv.config();

// Убрано тестовое ограничение - обрабатываем все карты

async function scanForMaps(outputDir: string): Promise<void> {
  let browserManager: BrowserManager | null = null;
  let webhook: DiscordWebhook | null = null;
  let facepunchUploader: FacepunchUploader | null = null;
  
  try {
    logger.info('🔍 Starting map search on rustmaps.ru...');
    
    // Initialize webhook
    if (WEBHOOK_CONFIG.enabled) {
      webhook = new DiscordWebhook(WEBHOOK_CONFIG);
      logger.info('📤 Discord webhook activated');
    }
    
    // Initialize Facepunch uploader
    if (FACEPUNCH_CONFIG.enabled) {
      facepunchUploader = new FacepunchUploader();
      logger.info('🚀 Facepunch upload activated');
    }
    
    // Initialize browser
    browserManager = new BrowserManager();
    await browserManager.initialize();
    const page = await browserManager.createPage();
    
    // Create map parser
    const mapParser = new MapParser(browserManager, DEFAULT_CONFIG.baseUrl);
    const downloader = new FileDownloader(outputDir);
    await downloader.initialize();
    
    const cacheManager = downloader.getCacheManager();
    
    // Show cache statistics
    const stats = await downloader.getCacheStats();
    logger.info(`📊 Cache statistics:`);
    logger.info(`   Total maps found: ${stats.totalFound}`);
    logger.info(`   Downloaded: ${stats.totalDownloaded}`);
    logger.info(`   Remaining: ${stats.remaining}`);
    if (stats.lastScan) {
      logger.info(`   Last scan: ${new Date(stats.lastScan).toLocaleString()}`);
    }
    
    // Parse main page
    logger.info('📖 Parsing main page for new maps...');
    const newMaps = await mapParser.parseMainPage();
    
    if (newMaps.length === 0) {
      logger.warn('❌ No maps found on main page');
      return;
    }
    
    // Stream processing: parse → download → upload → notify
    logger.info(`🔍 Getting detailed information for ${newMaps.length} maps...`);
    const mapsWithDetails: MapData[] = [];
    let skippedEmptyMaps = 0;
    let errorCount = 0;
    let processedCount = 0;
    let downloadedCount = 0;
    let facepunchUploadedCount = 0;
    
    // Stream processing: parse → download → upload → notify
    for (let i = 0; i < newMaps.length; i++) {
      const map = newMaps[i];
      processedCount++;
      
      if (processedCount % 100 === 0 || processedCount <= 20) {
        logger.info(`📝 Processing map ${processedCount}/${newMaps.length}: ${map.title}`);
      }
      
      try {
        const detailedMap = await mapParser.getDetailedMapInfo(map);
        
        // Skip if map has no files
        if (!detailedMap.mapFiles || detailedMap.mapFiles.length === 0) {
          skippedEmptyMaps++;
          continue;
        }
        
        // Process each map file
        for (const mapFile of detailedMap.mapFiles) {
          if (!mapFile.downloadUrl) continue;
          
          // Check if file is already downloaded
          if (cacheManager.isFileAlreadyDownloaded(mapFile.downloadUrl)) {
            continue;
          }
          
          // Create file data
          const fileMapData: MapData = {
            ...detailedMap,
            downloadUrl: mapFile.downloadUrl,
            title: `${detailedMap.title} - ${mapFile.name}`,
            mapFiles: [mapFile]
          };
          
          try {
            // 1. DOWNLOAD file
            logger.info(`📥 Downloading: ${fileMapData.title}`);
            const downloadResult = await downloader.downloadMap(fileMapData);
            
            if (!downloadResult) {
              logger.error(`❌ Download error: ${fileMapData.title}`);
              continue;
            }
            
            downloadedCount++;
            logger.success(`✅ Downloaded: ${fileMapData.title}`);
            
            // 2. UPLOAD to Facepunch API
            if (facepunchUploader && FACEPUNCH_CONFIG.enabled) {
              try {
                logger.info(`🚀 Uploading to Facepunch: ${fileMapData.title}`);
                
                // Generate file path same as in FileDownloader
                function getFilename(mapData: MapData, url: string): string {
                  const urlParts = new URL(url);
                  const filename = urlParts.pathname.split('/').pop() || '';
                  
                  if (filename && filename.includes('.')) {
                    let sanitizedTitle = sanitize(mapData.title).substring(0, 50);
                    const extension = path.extname(filename);
                    
                    if (sanitizedTitle.toLowerCase().endsWith(extension.toLowerCase())) {
                      sanitizedTitle = sanitizedTitle.slice(0, -extension.length);
                    }
                    
                    return `${mapData.mid}_${sanitizedTitle}${extension}`;
                  }
                  
                  return `${mapData.mid}_${sanitize(mapData.title)}.map`;
                }
                
                if (!fileMapData.downloadUrl) continue;
                
                const filename = getFilename(fileMapData, fileMapData.downloadUrl);
                const filePath = path.join(outputDir, filename);
                
                const facepunchResult = await facepunchUploader.uploadMapFromFile(filePath);
                
                if (facepunchResult.success && facepunchResult.url) {
                  fileMapData.facepunchUrl = facepunchResult.url;
                  facepunchUploadedCount++;
                  logger.success(`✅ Uploaded to Facepunch: ${fileMapData.title}`);
                  
                  // 3. SEND Discord notification
                  if (webhook && WEBHOOK_CONFIG.notifyOnNewMaps) {
                    try {
                      await webhook.sendNewMapNotification(fileMapData);
                      logger.success(`📤 Notification sent: ${fileMapData.title}`);
                    } catch (error) {
                      logger.error(`❌ Notification error: ${error}`);
                    }
                  }
                } else {
                  logger.error(`❌ Facepunch upload error: ${facepunchResult.error}`);
                }
              } catch (error) {
                logger.error(`❌ Facepunch upload error: ${error}`);
              }
            }
            
          } catch (error) {
            logger.error(`❌ File processing error ${mapFile.name}: ${error}`);
          }
        }
        
        // Small pause to not overload server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        logger.debug(`Error getting map details ${map.mid}: ${error}`);
        errorCount++;
      }
      
      // Show progress every 500 maps
      if (processedCount % 500 === 0) {
        logger.info(`📊 Progress: ${processedCount}/${newMaps.length} maps processed`);
        logger.info(`   📥 Files downloaded: ${downloadedCount}`);
        logger.info(`   🚀 Uploaded to Facepunch: ${facepunchUploadedCount}`);
        logger.info(`   ⏭️  Skipped empty: ${skippedEmptyMaps}`);
        logger.info(`   ❌ Errors: ${errorCount}`);
      }
    }

    logger.success(`🎉 Stream processing completed!`);
    logger.info(`📊 Final processing statistics:`);
    logger.info(`   Maps processed: ${processedCount}`);
    logger.info(`   Files downloaded: ${downloadedCount}`);
    logger.info(`   Uploaded to Facepunch: ${facepunchUploadedCount}`);
    logger.info(`   Skipped (no files): ${skippedEmptyMaps}`);
    logger.info(`   Errors: ${errorCount}`);

    // Send final summary to Discord
    if (webhook && WEBHOOK_CONFIG.notifyOnScanComplete) {
      await webhook.sendScanSummary({
        totalFound: newMaps.length,
        newFiles: downloadedCount,
        downloaded: downloadedCount,
        errors: errorCount,
        facepunchUploaded: facepunchUploadedCount
      });
    }

  } catch (error) {
    logger.error('Critical error during map scanning', error as Error);
    throw error;
  } finally {
    if (browserManager) {
      logger.info('Closing browser...');
      await browserManager.close();
      logger.success('Browser closed');
    }
  }
}

async function continuousMonitoring(outputDir: string, intervalMinutes: number): Promise<void> {
  logger.info(`🔄 Starting continuous monitoring (every ${intervalMinutes} minutes)...`);
  
  while (true) {
    try {
      logger.info('🔍 Starting scheduled scan...');
      await scanForMaps(outputDir);
      logger.success('✅ Scheduled scan completed');
      
      logger.info(`⏰ Waiting ${intervalMinutes} minutes until next scan...`);
      await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
      
    } catch (error) {
      logger.error('Error during scheduled scan:', error as Error);
      logger.info(`⏰ Waiting ${intervalMinutes} minutes before retry...`);
      await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
    }
  }
}

async function showCacheStats(outputDir: string): Promise<void> {
  try {
    const downloader = new FileDownloader(outputDir);
    await downloader.initialize();
    
    const stats = await downloader.getCacheStats();
    
    logger.info('📊 Cache Statistics:');
    logger.info(`   Total maps found: ${stats.totalFound}`);
    logger.info(`   Downloaded files: ${stats.totalDownloaded}`);
    logger.info(`   Remaining: ${stats.remaining}`);
    logger.info(`   Success rate: ${stats.totalFound > 0 ? Math.round((stats.totalDownloaded / stats.totalFound) * 100) : 0}%`);
    
    if (stats.lastScan) {
      logger.info(`   Last scan: ${new Date(stats.lastScan).toLocaleString()}`);
    }
    
    // Show file system statistics
    const outputExists = await fs.pathExists(outputDir);
    if (outputExists) {
      const files = await fs.readdir(outputDir);
      const mapFiles = files.filter(f => f.endsWith('.map'));
      logger.info(`   Files on disk: ${mapFiles.length} .map files`);
    }
    
  } catch (error) {
    logger.error('Error getting cache statistics:', error as Error);
  }
}

async function resetCache(outputDir: string): Promise<void> {
  try {
    logger.info('🗑️ Resetting download cache...');
    
    const downloader = new FileDownloader(outputDir);
    await downloader.initialize();
    await downloader.resetDownloadCache();
    
    logger.success('✅ Cache reset completed');
    
  } catch (error) {
    logger.error('Error resetting cache:', error as Error);
  }
}

async function testFacepunchUpload(): Promise<void> {
  try {
    logger.info('🧪 Testing Facepunch API upload...');
    
    if (!FACEPUNCH_CONFIG.enabled) {
      logger.error('❌ FACEPUNCH_UPLOAD_ENABLED is not set to true');
      return;
    }
    
    const uploader = new FacepunchUploader();
    
    // Test data
    const testMapData: MapData = {
      mid: 'test-123',
      title: 'Test Facepunch Upload',
      url: 'https://rustmaps.ru/index.php?mode=map&mid=test-123',
      description: 'This is a test message for Facepunch API upload testing',
      imageUrl: 'https://example.com/test_preview.jpg',
      mapFiles: [
        {
          name: 'test_map.map',
          size: '1.5 MB',
          downloadUrl: 'https://example.com/test_map.map',
          uploadDate: new Date().toISOString()
        }
      ],
      tags: ['test', 'facepunch', 'api'],
      downloadUrl: 'https://example.com/test_map.map'
    };
    
    // Create test file
    const testContent = Buffer.from('Test map file content for Facepunch API testing');
    const testFilename = 'test_facepunch_upload.map';
    const testFilePath = path.join('./output', testFilename);
    
    await fs.ensureDir('./output');
    await fs.writeFile(testFilePath, testContent);
    
    logger.info(`📤 Uploading test file: ${testFilename}`);
    
    // Upload test file
    const result = await uploader.uploadMapFromFile(testFilePath);
    
    if (result.success && result.url) {
      logger.success(`✅ Facepunch API test successful!`);
      logger.info(`🌐 Upload URL: ${result.url}`);
    } else {
      logger.error(`❌ Facepunch API test failed: ${result.error}`);
    }
    
    // Clean up test file
    try {
      await fs.remove(testFilePath);
      logger.debug('Test file cleaned up');
    } catch (error) {
      logger.warn('Could not clean up test file:', error as Error);
    }
    
  } catch (error) {
    logger.error('❌ Error testing Facepunch API:', error as Error);
  }
}

async function main() {
  const program = new Command();
  
  program
    .name('rustmaps-parser')
    .description('CLI tool for parsing and downloading maps from rustmaps.ru')
    .version('1.0.0');
  
  program
    .command('scan')
    .description('Scan and download new maps from rustmaps.ru')
    .option('-o, --output <dir>', 'Output directory for downloaded maps', './output')
    .action(async (options) => {
      await scanForMaps(options.output);
    });
  
  program
    .command('monitor')
    .description('Continuous monitoring for new maps')
    .option('-o, --output <dir>', 'Output directory for downloaded maps', './output')
    .option('-i, --interval <minutes>', 'Check interval in minutes', '60')
    .action(async (options) => {
      const interval = parseInt(options.interval);
      if (isNaN(interval) || interval < 1) {
        logger.error('❌ Invalid interval. Must be a positive number');
        process.exit(1);
      }
      await continuousMonitoring(options.output, interval);
    });
  
  program
    .command('stats')
    .description('Show cache statistics')
    .option('-o, --output <dir>', 'Output directory', './output')
    .action(async (options) => {
      await showCacheStats(options.output);
    });
  
  program
    .command('reset')
    .description('Reset download cache')
    .option('-o, --output <dir>', 'Output directory', './output')
    .action(async (options) => {
      await resetCache(options.output);
    });

  program
    .command('test-facepunch')
    .description('Test Facepunch API upload')
    .action(async () => {
      await testFacepunchUpload();
    });

  program
    .command('web')
    .description('Start web browser interface for viewing maps')
    .option('-p, --port <port>', 'Port for web server', '3000')
    .action(async (options) => {
      // Запускаем веб-сервер
      const { execSync } = require('child_process');
      process.env.PORT = options.port;
      
      logger.info(`🌐 Запуск веб-интерфейса на порту ${options.port}...`);
      logger.info(`📖 Откройте браузер: http://localhost:${options.port}`);
      
      try {
        execSync('ts-node src/server.ts', { stdio: 'inherit' });
      } catch (error) {
        logger.error('Ошибка запуска веб-сервера:', error as Error);
      }
    });
  
  await program.parseAsync();
}

// Обработка сигналов для корректного завершения
process.on('SIGINT', async () => {
  logger.info('🛑 Получен сигнал прерывания, завершение работы...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Получен сигнал завершения, закрытие...');
  process.exit(0);
});

// Запуск
main().catch(error => {
  logger.error('Фатальная ошибка:', error);
  process.exit(1);
}); 