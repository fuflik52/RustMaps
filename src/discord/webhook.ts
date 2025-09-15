import axios from 'axios';
import { MapData } from '../types';
import { logger } from '../utils/logger';

export interface WebhookConfig {
  url: string;
  enabled: boolean;
}

export class DiscordWebhook {
  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
    this.config = config;
  }

  async sendNewMapNotification(mapData: MapData): Promise<void> {
    if (!mapData.facepunchUrl) {
      logger.debug(`Skipping Discord notification for ${mapData.title} - no Facepunch URL`);
      return;
    }

    try {
      const embed: any = {
        title: "🗺️ New Map on Facepunch!",
        description: mapData.description || "New map available for download",
        color: 0x00ff00,
        fields: [
          {
            name: "📝 Title",
            value: mapData.title,
            inline: true
          },
          {
            name: "🆔 ID",
            value: mapData.mid,
            inline: true
          },
          {
            name: "🌐 Facepunch URL",
            value: `[Download](${mapData.facepunchUrl})`,
            inline: false
          },
          {
            name: "🔗 Original Topic",
            value: `[View on rustmaps.ru](${mapData.url})`,
            inline: false
          }
        ],
        footer: {
          text: "rustmaps.ru parser"
        },
        timestamp: new Date().toISOString()
      };

      if (mapData.imageUrl) {
        embed.thumbnail = { url: mapData.imageUrl };
      }

      if (mapData.tags && mapData.tags.length > 0) {
        embed.fields.push({
          name: "🏷️ Tags",
          value: mapData.tags.slice(0, 10).join(', '),
          inline: false
        });
      }

      const payload = {
        embeds: [embed]
      };

      await axios.post(this.config.url, payload);
      logger.debug(`Discord notification sent for: ${mapData.title}`);

    } catch (error) {
      logger.error(`Error sending Discord notification for ${mapData.title}:`, error as Error);
      throw error;
    }
  }

  async sendBulkMapNotification(maps: MapData[]): Promise<void> {
    const mapsWithFacepunch = maps.filter(map => map.facepunchUrl);
    
    if (mapsWithFacepunch.length === 0) {
      logger.debug('No maps with Facepunch URLs to notify about');
      return;
    }

    try {
      for (const map of mapsWithFacepunch) {
        await this.sendNewMapNotification(map);
        // Small delay between notifications
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error('Error sending bulk Discord notifications:', error as Error);
      throw error;
    }
  }

  async sendScanSummary(stats: {
    totalFound: number;
    newFiles: number;
    downloaded: number;
    errors: number;
    facepunchUploaded?: number;
  }): Promise<void> {
    try {
      const embed = {
        title: "📊 Scan Summary",
        color: stats.errors > 0 ? 0xff9900 : 0x00ff00,
        fields: [
          {
            name: "🔍 Total Maps Found",
            value: stats.totalFound.toString(),
            inline: true
          },
          {
            name: "📥 New Files",
            value: stats.newFiles.toString(),
            inline: true
          },
          {
            name: "✅ Downloaded",
            value: stats.downloaded.toString(),
            inline: true
          }
        ],
        footer: {
          text: "rustmaps.ru parser"
        },
        timestamp: new Date().toISOString()
      };

      if (stats.facepunchUploaded !== undefined) {
        embed.fields.push({
          name: "🚀 Uploaded to Facepunch",
          value: stats.facepunchUploaded.toString(),
          inline: true
        });
      }

      if (stats.errors > 0) {
        embed.fields.push({
          name: "❌ Errors",
          value: stats.errors.toString(),
          inline: true
        });
      }

      const payload = {
        embeds: [embed]
      };

      await axios.post(this.config.url, payload);
      logger.debug('Scan summary sent to Discord');

    } catch (error) {
      logger.error('Error sending scan summary to Discord:', error as Error);
      throw error;
    }
  }
} 