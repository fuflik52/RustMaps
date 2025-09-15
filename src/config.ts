export const WEBHOOK_CONFIG = {
  enabled: !!process.env.DISCORD_WEBHOOK_URL,
  url: process.env.DISCORD_WEBHOOK_URL || '',
  notifyOnNewMaps: true,
  notifyOnScanComplete: true,
};

export const FACEPUNCH_CONFIG = {
  enabled: process.env.FACEPUNCH_UPLOAD_ENABLED === 'true',
  uploadAfterDownload: true,
  deleteLocalAfterUpload: process.env.DELETE_LOCAL_AFTER_UPLOAD === 'true',
  maxRetries: 10,
  retryDelay: 1000,
}; 