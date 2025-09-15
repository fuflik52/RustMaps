export interface MapData {
  mid: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  downloadUrl?: string;
  facepunchUrl?: string;
  mapFiles?: MapFile[];
  content?: string;
  tags?: string[];
  metadata?: MapMetadata;
}

export interface MapFile {
  name: string;
  size: string;
  sizeBytes?: number;
  downloadUrl: string;
  facepunchUrl?: string;
  uploadDate: string;
  localPath?: string;
}

export interface MapMetadata {
  author?: string;
  uploadDate?: string;
  views?: number;
  downloads?: number;
  rating?: number;
  category?: string;
}

export interface ParserConfig {
  baseUrl: string;
  outputDir: string;
  concurrency: number;
  retryAttempts: number;
  timeout: number;
  userAgent: string;
  headless: boolean;
}

export interface DownloadStats {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
}

export interface BrowserOptions {
  headless: boolean;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  timeout: number;
}

export interface DownloadProgress {
  mapId: string;
  filename: string;
  progress: number;
  size: number;
  speed: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'skipped';
}

export class ParseError extends Error {
  constructor(
    message: string,
    public code: string,
    public url?: string
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class DownloadError extends Error {
  constructor(
    message: string,
    public code: string,
    public mapId?: string
  ) {
    super(message);
    this.name = 'DownloadError';
  }
} 