import puppeteer, { Browser, Page } from 'puppeteer';
import { BrowserOptions } from '../types';
import { BROWSER_OPTIONS, DELAYS } from '../config/defaults';
import { logger } from '../utils/logger';

export class BrowserManager {
  private browser: Browser | null = null;
  private pages: Page[] = [];
  private options: BrowserOptions;

  constructor(options: Partial<BrowserOptions> = {}) {
    this.options = { ...BROWSER_OPTIONS, ...options };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing browser...');
      
      this.browser = await puppeteer.launch({
        headless: this.options.headless, // 'new' is default for true now, or use 'shell' for old headless
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1920,1080'
        ],
        defaultViewport: this.options.viewport,
        timeout: this.options.timeout
      });

      logger.success('Browser initialized');
    } catch (error) {
      logger.error('Browser initialization error', error as Error);
      throw error;
    }
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    await page.setUserAgent(this.options.userAgent);
    await page.setViewport(this.options.viewport);
    
    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['font', 'image', 'stylesheet', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Handle console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logger.debug(`Console error: ${msg.text()}`);
      }
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      logger.debug(`Page error: ${error.message}`);
    });

    this.pages.push(page);
    return page;
  }

  async navigateToPage(page: Page, url: string): Promise<void> {
    try {
      logger.debug(`Navigating to page: ${url}`);
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout
      });

      // Wait for full load
      await new Promise(resolve => setTimeout(resolve, DELAYS.pageLoad));
      
      logger.debug('Page loaded');
    } catch (error) {
      logger.error(`Page load error ${url}`, error as Error);
      throw error;
    }
  }

  async scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  async waitForElement(page: Page, selector: string, timeout: number = 10000): Promise<void> {
    try {
      await page.waitForSelector(selector, { timeout });
    } catch (error) {
      logger.warn(`Element ${selector} not found within ${timeout}ms`);
      throw error;
    }
  }

  async safeClick(page: Page, selector: string): Promise<boolean> {
    try {
      await this.waitForElement(page, selector);
      await page.click(selector);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } catch (error) {
      logger.debug(`Failed to click element ${selector}`);
      return false;
    }
  }

  async extractText(page: Page, selector: string): Promise<string> {
    try {
      return await page.$eval(selector, (el) => el.textContent?.trim() || '');
    } catch {
      return '';
    }
  }

  async extractAttribute(page: Page, selector: string, attribute: string): Promise<string> {
    try {
      return await page.$eval(selector, (el, attr) => el.getAttribute(attr) || '', attribute);
    } catch {
      return '';
    }
  }

  async closePage(page: Page): Promise<void> {
    const index = this.pages.indexOf(page);
    if (index > -1) {
      this.pages.splice(index, 1);
    }
    
    if (!page.isClosed()) {
      await page.close();
    }
  }

  async close(): Promise<void> {
    logger.info('Closing browser...');
    
    // Close all pages
    for (const page of this.pages) {
      if (!page.isClosed()) {
        await page.close();
      }
    }
    
    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.pages = [];
    logger.success('Browser closed');
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }

  getPageCount(): number {
    return this.pages.length;
  }
} 