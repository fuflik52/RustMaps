import axios, { AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';
import { ProxyAgent } from 'proxy-agent';

export interface PreflightResult {
  effectiveBaseUrl: string;
  transport: 'https' | 'http';
  reason: string;
}

function getHostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

export function configureAxiosProxy(): void {
  try {
    const agent = new ProxyAgent();
    // Always set; ProxyAgent will no-op when no proxies are configured
    (axios.defaults as any).httpAgent = agent as any;
    (axios.defaults as any).httpsAgent = agent as any;
    logger.debug('Axios proxy agent configured from environment');
  } catch (error) {
    logger.warn('Failed to configure axios proxy agent; proceeding without proxy', error as Error);
  }
}

export async function preflightConnectivity(baseUrl: string, timeoutMs: number = 5000): Promise<PreflightResult> {
  const host = getHostFromUrl(baseUrl);

  const tryRequest = async (url: string, headers?: Record<string, string>) => {
    const config: AxiosRequestConfig = {
      url,
      method: 'HEAD',
      maxRedirects: 0,
      timeout: timeoutMs,
      validateStatus: () => true,
      headers
    };
    try {
      const res = await axios(config);
      return { ok: res.status < 500, status: res.status };
    } catch (error) {
      const message = (error as Error).message || 'unknown error';
      return { ok: false, status: 0, error: message } as const;
    }
  };

  // 1) Prefer HTTPS
  const httpsUrl = `https://${host}`;
  let res = await tryRequest(httpsUrl);
  if (res.ok) {
    return { effectiveBaseUrl: httpsUrl, transport: 'https', reason: `HTTPS reachable (status ${res.status})` };
  }

  logger.warn(`HTTPS preflight failed (${host}) - falling back to HTTP`);

  // 2) Try HTTP
  const httpUrl = `http://${host}`;
  res = await tryRequest(httpUrl);
  if (res.ok) {
    return { effectiveBaseUrl: httpUrl, transport: 'http', reason: `HTTP reachable (status ${res.status})` };
  }

  // 3) If IPv4 is provided, try direct IP over HTTP with Host header
  const forcedIPv4 = process.env.RUSTMAPS_IPV4 || process.env.RUSTMAPS_FORCE_IPV4;
  if (forcedIPv4) {
    const ipUrl = `http://${forcedIPv4}`;
    res = await tryRequest(ipUrl, { Host: host });
    if (res.ok) {
      // Use HTTP scheme with hostname; Puppeteer can map host->IP via resolver rules
      return { effectiveBaseUrl: httpUrl, transport: 'http', reason: `HTTP via IPv4 ${forcedIPv4} reachable` };
    }
  }

  // 4) Respect explicit FORCE_HTTP_FALLBACK even if checks failed
  if ((process.env.FORCE_HTTP_FALLBACK || '').toLowerCase() === 'true') {
    return { effectiveBaseUrl: httpUrl, transport: 'http', reason: 'FORCE_HTTP_FALLBACK enabled' };
  }

  // Default back to original
  return { effectiveBaseUrl: baseUrl, transport: baseUrl.startsWith('https') ? 'https' : 'http', reason: 'Preflight could not verify connectivity' };
}


