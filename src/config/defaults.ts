import { ParserConfig, BrowserOptions } from '../types';

export const DEFAULT_CONFIG: ParserConfig = {
  baseUrl: process.env.RUSTMAPS_BASE_URL || 'https://rustmaps.ru',
  outputDir: process.env.OUTPUT_DIR || './output',
  concurrency: process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY) : 3,
  retryAttempts: process.env.RETRY_ATTEMPTS ? parseInt(process.env.RETRY_ATTEMPTS) : 2,
  timeout: process.env.NETWORK_TIMEOUT_MS ? parseInt(process.env.NETWORK_TIMEOUT_MS) : 15000,
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  headless: (process.env.HEADLESS || 'true').toLowerCase() !== 'false'
};

export const BROWSER_OPTIONS: BrowserOptions = {
  headless: DEFAULT_CONFIG.headless,
  userAgent: DEFAULT_CONFIG.userAgent,
  viewport: {
    width: 1280,
    height: 720
  },
  timeout: DEFAULT_CONFIG.timeout
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