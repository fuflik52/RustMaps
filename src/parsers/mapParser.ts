import { Page } from 'puppeteer';
import { MapData, MapFile, MapMetadata } from '../types';
import { SELECTORS, DELAYS } from '../config/defaults';
import { BrowserManager } from '../core/browser';
import { logger } from '../utils/logger';

export class MapParser {
  private browserManager: BrowserManager;
  private baseUrl: string;

  constructor(browserManager: BrowserManager, baseUrl: string) {
    this.browserManager = browserManager;
    this.baseUrl = baseUrl;
  }

  async parseMainPage(): Promise<MapData[]> {
    const page = await this.browserManager.createPage();
    
    try {
      logger.info('Parsing main page rustmaps.ru...');
      
      await page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      logger.info('Page loaded, extracting maps...');
      
      // Wait for map containers to load
      await page.waitForSelector('.map-container', { timeout: 10000 });
      
      logger.info('Extracting map data...');
      
      const maps = await page.evaluate(() => {
        const mapContainers = document.querySelectorAll('.map-container');
        const results: any[] = [];
        
        mapContainers.forEach((container) => {
          try {
            // data-url находится на .map-content внутри .map-container
            const mapContent = container.querySelector('.map-content');
            const dataUrl = mapContent?.getAttribute('data-url');
            if (!dataUrl) return;
            
            const titleElement = container.querySelector('.map-title');
            const title = titleElement?.textContent?.trim() || 'Untitled';
            
            // Extract map ID from data-url
            const urlMatch = dataUrl.match(/mid=(\d+)/);
            const mid = urlMatch ? urlMatch[1] : '';
            
            if (mid) {
              results.push({
                mid,
                title,
                url: dataUrl.startsWith('http') ? dataUrl : 'https://rustmaps.ru' + dataUrl,
                description: '',
                imageUrl: '',
                mapFiles: [],
                tags: []
              });
            }
          } catch (error) {
            console.error('Error processing map container:', error);
          }
        });
        
        return results;
      });

      logger.success(`Extracted ${maps.length} maps`);
      return maps;
      
    } catch (error) {
      logger.error('Error parsing main page:', error as Error);
      throw error;
    } finally {
      await page.close();
    }
  }

  private generateTags(title: string, content: string): string[] {
    const tags: Set<string> = new Set();
    
    // Extract tags from title
    if (title) {
      const titleWords = title.split(/[\s_\-\.]+/).filter(word => word.length > 2);
      titleWords.forEach(word => tags.add(word.toLowerCase()));
    }
    
    // Extract common map-related keywords from content
    const keywords = ['rust', 'map', 'custom', 'procedural', 'island', 'desert', 'snow', 'forest'];
    keywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        tags.add(keyword);
      }
    });
    
    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  /**
   * Получает детальную информацию о карте включая файлы и контент
   */
  async getDetailedMapInfo(mapData: MapData): Promise<MapData> {
    const page = await this.browserManager.createPage();

    try {
      logger.debug(`Getting detailed info for map ${mapData.mid}...`);
      
      await page.goto(mapData.url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Replaced waitForTimeout
      
      // Extract detailed information
      const detailedInfo = await page.evaluate(() => {
        const result: any = {
          mapFiles: [],
          content: '',
          metadata: {}
        };

        // Extract map files from #mapfiles block
        const mapFilesContainer = document.querySelector('#mapfiles');
        if (mapFilesContainer) {
          const mapFileElements = mapFilesContainer.querySelectorAll('.mapfile');
          
          mapFileElements.forEach((fileElement: any) => {
            try {
              const nameElement = fileElement.querySelector('.info .value');
              const sizeElement = fileElement.querySelectorAll('.info .value')[1];
              const linkElement = fileElement.querySelector('.info .value a[href]');
              const dateElement = fileElement.querySelectorAll('.info .value')[3];

              if (nameElement && linkElement) {
                const fileName = nameElement.textContent?.trim() || '';
                const fileSize = sizeElement?.textContent?.trim() || '';
                const downloadUrl = linkElement.getAttribute('href') || '';
                const uploadDate = dateElement?.textContent?.trim() || '';

                console.log(`Found file: ${fileName}`);
                
                result.mapFiles.push({
                  name: fileName,
                  size: fileSize,
                  downloadUrl: downloadUrl,
                  uploadDate: uploadDate
                });
              }
            } catch (error) {
              console.error('Error extracting map file:', error);
            }
          });
        }

        // Extract page content for tag generation
        const contentElements = document.querySelectorAll('p, div.content, .description, .post-content, .map-description');
        const contentTexts: string[] = [];
        
        contentElements.forEach((element: any) => {
          const text = element.textContent?.trim();
          if (text && text.length > 10) {
            contentTexts.push(text);
          }
        });

        result.content = contentTexts.join(' ').trim();

        // Extract metadata
        const titleElement = document.querySelector('h1, .map-title');
        if (titleElement) {
          result.metadata.title = titleElement.textContent?.trim();
        }

        // Try to find author
        const authorElements = document.querySelectorAll('.author, .by, .uploaded-by');
        authorElements.forEach((el: any) => {
          const text = el.textContent?.trim();
          if (text && !result.metadata.author) {
            result.metadata.author = text;
          }
        });

        return result;
      });

      // Generate tags from title and content
      const tags = this.generateTags(mapData.title, detailedInfo.content);

      const result: MapData = {
        ...mapData,
        mapFiles: detailedInfo.mapFiles || [],
        tags: tags,
        description: detailedInfo.content.substring(0, 200) || mapData.description
      };

      logger.debug(`Found ${result.mapFiles?.length || 0} files for map ${mapData.mid}`);
      return result;

    } catch (error) {
      logger.error(`Error getting detailed info for map ${mapData.mid}:`, error as Error);
      return mapData;
    } finally {
      await page.close();
    }
  }

  async getMapDownloadUrl(mapData: MapData): Promise<string | null> {
    const page = await this.browserManager.createPage();

    try {
      logger.debug(`Получение ссылки скачивания для карты ${mapData.mid}...`);
      
      await page.goto(mapData.url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Replaced waitForTimeout
      
      // Ищем ссылку для скачивания
      const downloadUrl = await page.evaluate(() => {
        // Пробуем разные селекторы для кнопки скачивания
        const selectors = [
          'a[href*=".map"]',
          'a[href*="download"]', 
          'a[href*="mapfiles"]',
          '.download-link',
          '.btn-download',
          'input[value*=".map"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const href = element.getAttribute('href') || element.getAttribute('value');
            if (href) {
              console.log(`Найдена ссылка скачивания: ${href}`);
              return href;
            }
          }
        }
        
        console.log('Ссылка скачивания не найдена');
        return null;
      });

      if (downloadUrl) {
        const fullUrl = downloadUrl.startsWith('http') 
          ? downloadUrl 
          : this.baseUrl + downloadUrl;
        
        logger.debug(`Найдена ссылка: ${fullUrl}`);
        return fullUrl;
      }

      return null;

    } catch (error) {
      logger.error(`Ошибка получения ссылки для карты ${mapData.mid}`, error as Error);
      return null;
    } finally {
      await this.browserManager.closePage(page);
    }
  }
} 