import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface FacepunchUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  filename: string;
}

export class FacepunchUploader {
  private maxRetries: number = 10;
  private baseDelay: number = 1000;

  constructor() {}

  private createSafeFilename(originalPath: string): string {
    const basename = path.basename(originalPath, path.extname(originalPath));
    const extension = path.extname(originalPath);
    
    // Remove Russian characters and special symbols, replace with Latin
    let safeName = basename
      .replace(/[а-я]/gi, (match) => {
        const translitMap: { [key: string]: string } = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
          'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return translitMap[match.toLowerCase()] || match;
      })
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace all other characters with underscores
      .replace(/_+/g, '_') // Remove repeated underscores
      .replace(/^_|_$/g, ''); // Remove underscores at start and end
    
    // If name became empty, use timestamp
    if (!safeName) {
      safeName = `map_${Date.now()}`;
    }
    
    return safeName + extension;
  }

  async uploadMapFromFile(filePath: string): Promise<FacepunchUploadResult> {
    const originalFilename = path.basename(filePath);
    const safeFilename = this.createSafeFilename(filePath);
    
    try {
      // Check file existence
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'File not found',
          filename: originalFilename
        };
      }

      // Check that it's a .map file
      if (!filePath.endsWith('.map')) {
        return {
          success: false,
          error: 'Only .map files are supported',
          filename: originalFilename
        };
      }

      // Read file as buffer
      const fileBuffer = await fs.promises.readFile(filePath);
      
      logger.info(`🚀 Uploading map ${originalFilename} → ${safeFilename} to Facepunch API...`);
      
      const uploadUrl = await this.uploadMapImplAsync(fileBuffer, safeFilename);
      
      if (uploadUrl) {
        logger.success(`✅ Map uploaded to Facepunch: ${safeFilename}`);
        return {
          success: true,
          url: uploadUrl,
          filename: originalFilename
        };
      } else {
        logger.error(`❌ Failed to upload map: ${safeFilename}`);
        return {
          success: false,
          error: 'Upload failed after all retries',
          filename: originalFilename
        };
      }

    } catch (error) {
      logger.error(`❌ Map upload error ${safeFilename}:`, error as Error);
      return {
        success: false,
        error: (error as Error).message,
        filename: originalFilename
      };
    }
  }

  async uploadMapFromBuffer(fileBuffer: Buffer, filename: string): Promise<FacepunchUploadResult> {
    try {
      logger.info(`🚀 Uploading map ${filename} to Facepunch API...`);
      
      const uploadUrl = await this.uploadMapImplAsync(fileBuffer, filename);
      
      if (uploadUrl) {
        logger.success(`✅ Map uploaded to Facepunch: ${filename}`);
        return {
          success: true,
          url: uploadUrl,
          filename
        };
      } else {
        logger.error(`❌ Failed to upload map: ${filename}`);
        return {
          success: false,
          error: 'Upload failed after all retries',
          filename
        };
      }

    } catch (error) {
      logger.error(`❌ Map upload error ${filename}:`, error as Error);
      return {
        success: false,
        error: (error as Error).message,
        filename
      };
    }
  }

  private async uploadMapImplAsync(fileBuffer: Buffer, mapFileName: string): Promise<string | null> {
    const requestUri = `https://api.facepunch.com/api/public/rust-map-upload/${mapFileName}`;
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        logger.debug(`Attempt ${retries + 1}/${this.maxRetries} uploading ${mapFileName}`);
        
        const response = await axios.put(requestUri, fileBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000, // 2 minutes timeout
        });

        if (response.status >= 200 && response.status < 300) {
          const responseBody = response.data;
          if (!responseBody || !responseBody.startsWith("http")) {
            throw new Error("Backend sent an invalid success response when uploading the map.");
          }
          return responseBody;
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry
          logger.error(`Client error uploading ${mapFileName}: ${response.status} ${response.statusText}`);
          return null;
        } else {
          // Server error - retry
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        logger.debug(`Attempt ${retries + 1} failed: ${(error as Error).message}`);
        
        if (retries === this.maxRetries - 1) {
          logger.error(`All upload attempts for ${mapFileName} exhausted`);
          break;
        }
        
        // Exponential delay
        const delay = this.baseDelay + retries * 5000;
        logger.debug(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }

    return null;
  }

  async uploadMultipleMaps(filePaths: string[]): Promise<FacepunchUploadResult[]> {
    logger.info(`🚀 Starting upload of ${filePaths.length} maps to Facepunch API...`);
    
    const results: FacepunchUploadResult[] = [];
    
    // Upload one by one to avoid API overload
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      logger.info(`📤 Uploading ${i + 1}/${filePaths.length}: ${path.basename(filePath)}`);
      
      const result = await this.uploadMapFromFile(filePath);
      results.push(result);
      
      // Small pause between uploads
      if (i < filePaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.divider();
    logger.success(`🎉 Facepunch upload completed:`);
    logger.info(`   ✅ Success: ${successful}`);
    logger.info(`   ❌ Errors: ${failed}`);
    logger.divider();

    return results;
  }
} 