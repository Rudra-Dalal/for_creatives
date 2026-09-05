import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export interface ValidatedTarget {
  url: URL;
  ip: string;
  family: number;
}

export class SSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFValidationError';
  }
}

/**
 * Checks if an IPv4 address is in a private, loopback, or reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid -> block
  }

  const [a, b, c] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (a === 10) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link Local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Benchmark testing)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && parts[3] === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, or reserved range.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 (Loopback) & :: (Unspecified)
  if (normalized === '::1' || normalized === '::') return true;

  // IPv4-mapped IPv6 (::ffff:192.0.2.128 or ::ffff:c000:0280)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.substring(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }
  }

  // fc00::/7 (Unique Local Address)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // fe80::/10 (Link-local)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // ff00::/8 (Multicast)
  if (normalized.startsWith('ff')) return true;

  return false;
}

/**
 * Validates a single IP address against forbidden network ranges.
 */
export function isPrivateIP(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateIPv4(ip);
  }
  if (version === 6) {
    return isPrivateIPv6(ip);
  }
  return true; // Not a valid IP -> block
}

/**
 * Validates a user-submitted URL string and resolves its hostname.
 * Ensures the target does not resolve to private, loopback, or cloud-metadata IPs.
 */
export async function validateSafeUrl(urlString: string): Promise<ValidatedTarget> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new SSRFValidationError('Invalid URL format');
  }

  // Enforce protocol whitelist
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SSRFValidationError('Unsupported protocol: only http and https are allowed');
  }

  const hostname = parsedUrl.hostname;

  // Reject empty or localhost hostnames
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new SSRFValidationError('Forbidden hostname');
  }

  // If hostname is already an IP address
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new SSRFValidationError('Target IP address is in a forbidden private or local range');
    }
    return {
      url: parsedUrl,
      ip: hostname,
      family: net.isIPv4(hostname) ? 4 : 6,
    };
  }

  // Resolve hostname via DNS
  const resolved = await dns.promises.lookup(hostname, { all: true });
  if (!resolved || resolved.length === 0) {
    throw new SSRFValidationError('Unable to resolve target domain name');
  }

  // Check all resolved records - if ANY address is private/internal, reject the request
  for (const record of resolved) {
    if (isPrivateIP(record.address)) {
      throw new SSRFValidationError(
        `Domain resolves to forbidden IP address (${record.address})`
      );
    }
  }

  const primary = resolved[0];
  return {
    url: parsedUrl,
    ip: primary.address,
    family: primary.family,
  };
}

/**
 * Safely fetches HTML content from a URL while pinning the TCP/TLS connection
 * directly to the pre-validated IP address to eliminate DNS rebinding vulnerability.
 */
export async function safeFetchHtml(
  targetUrl: string,
  maxHops: number = 3
): Promise<{ html: string; finalUrl: string }> {
  if (maxHops <= 0) {
    throw new SSRFValidationError('Too many redirects');
  }

  const validated = await validateSafeUrl(targetUrl);
  const { url, ip, family } = validated;

  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const clientModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const port = url.port ? parseInt(url.port, 10) : defaultPort;

    // Create custom agent with pinned DNS lookup to prevent DNS rebinding
    const agent = new clientModule.Agent({
      lookup: (_hostname, options, callback) => {
        const cb = (typeof options === 'function' ? options : callback) as (
          err: Error | null,
          address: string | Array<{ address: string; family: number }>,
          family?: number
        ) => void;
        const opts = (typeof options === 'object' ? options : {}) as { all?: boolean };
        if (opts?.all) {
          cb(null, [{ address: ip, family }]);
        } else {
          cb(null, ip, family);
        }
      },
    });

    const requestOptions: https.RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      agent,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 CreativeWorkspace/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      servername: url.hostname, // TLS SNI
      timeout: 4000, // 4-second timeout
    };

    const req = clientModule.request(requestOptions, (res) => {
      // Handle 3xx Redirects safely
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, url.href).href;
        req.destroy();
        // Recursively validate and follow redirect
        safeFetchHtml(redirectUrl, maxHops - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        req.destroy();
        reject(new Error(`Upstream server returned HTTP status ${res.statusCode}`));
        return;
      }

      let data = '';
      let totalBytes = 0;
      const MAX_BYTES = 512 * 1024; // 512 KB max

      res.setEncoding('utf8');

      res.on('data', (chunk: string) => {
        totalBytes += Buffer.byteLength(chunk, 'utf8');
        if (totalBytes > MAX_BYTES) {
          req.destroy();
          resolve({ html: data, finalUrl: url.href });
          return;
        }
        data += chunk;
      });

      res.on('end', () => {
        resolve({ html: data, finalUrl: url.href });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Safely fetches an image from an external URL while pinning the TCP/TLS connection
 * directly to the pre-validated IP address. Validates image MIME type, enforces a 5MB
 * maximum payload ceiling, and applies a 4-second socket timeout.
 */
export async function safeFetchImage(
  targetUrl: string,
  maxHops: number = 3
): Promise<{ buffer: Buffer; contentType: string }> {
  if (maxHops <= 0) {
    throw new SSRFValidationError('Too many redirects');
  }

  const validated = await validateSafeUrl(targetUrl);
  const { url, ip, family } = validated;

  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const clientModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const port = url.port ? parseInt(url.port, 10) : defaultPort;

    // Pinned DNS lookup agent prevents DNS rebinding
    const agent = new clientModule.Agent({
      lookup: (_hostname, options, callback) => {
        const cb = (typeof options === 'function' ? options : callback) as (
          err: Error | null,
          address: string | Array<{ address: string; family: number }>,
          family?: number
        ) => void;
        const opts = (typeof options === 'object' ? options : {}) as { all?: boolean };
        if (opts?.all) {
          cb(null, [{ address: ip, family }]);
        } else {
          cb(null, ip, family);
        }
      },
    });

    const requestOptions: https.RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      agent,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 CreativeWorkspace/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      servername: url.hostname,
      timeout: 4000,
    };

    const req = clientModule.request(requestOptions, (res) => {
      // Handle 3xx Redirects
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, url.href).href;
        req.destroy();
        safeFetchImage(redirectUrl, maxHops - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        req.destroy();
        reject(new Error(`Upstream server returned HTTP status ${res.statusCode}`));
        return;
      }

      const rawContentType = res.headers['content-type'] || '';
      const contentType = rawContentType.split(';')[0].trim().toLowerCase();

      // Guard: strictly enforce image MIME type
      if (!contentType.startsWith('image/')) {
        req.destroy();
        reject(new Error(`Invalid upstream content-type: expected image/*, received '${rawContentType}'`));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB max ceiling

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_IMAGE_BYTES) {
          req.destroy();
          reject(new Error('Image payload exceeded maximum size limit (5MB)'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, contentType });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

