import { ParserConfig, BrowserOptions } from '../types';

export const DEFAULT_CONFIG: ParserConfig = {
  baseUrl: 'https://rustmaps.ru',
  outputDir: './output',
  concurrency: 3,
  retryAttempts: 2,
  timeout: 15000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  headless: true
};

export const BROWSER_OPTIONS: BrowserOptions = {
  headless: true,
  userAgent: DEFAULT_CONFIG.userAgent,
  viewport: {
    width: 1280,
    height: 720
  },
  timeout: 15000
};

export const SELECTORS = {
  mapContainer: '.map-container',
  mapContent: '.map-content',
  mapTitle: 'h3',
  mapDescription: 'small',
  downloadButton: 'a[href*=".map"]',
  downloadLink: 'a[href*="download"]',
  mapFile: 'a[href*="mapfiles"]',
  pagination: '.pagination',
  nextPage: '.next',
  prevPage: '.prev'
} as const;

export const DELAYS = {
  pageLoad: 3000,
  scroll: 1000,
  click: 500,
  retry: 2000
} as const; 