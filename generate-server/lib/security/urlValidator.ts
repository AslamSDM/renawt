/**
 * SSRF Protection: Validates URLs to block access to internal/private networks.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
  "metadata.google",
]);

/**
 * Check if an IP address is in a private/reserved range.
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 private ranges
  const ipv4Patterns = [
    /^10\./,                          // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
    /^192\.168\./,                     // 192.168.0.0/16
    /^127\./,                          // 127.0.0.0/8 (loopback)
    /^0\./,                            // 0.0.0.0/8
    /^169\.254\./,                     // 169.254.0.0/16 (link-local / cloud metadata)
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // 100.64.0.0/10 (CGNAT)
  ];

  return ipv4Patterns.some((pattern) => pattern.test(hostname));
}

/**
 * Validate that a URL is safe to fetch (not pointing to internal resources).
 */
export function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http and https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Block known dangerous hostnames
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return false;
    }

    // Block private IPs
    if (isPrivateIP(hostname)) {
      return false;
    }

    // Block AWS/GCP/Azure metadata endpoints
    if (hostname === "169.254.169.254" || hostname === "fd00:ec2::254") {
      return false;
    }

    // Block URLs with credentials
    if (url.username || url.password) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
