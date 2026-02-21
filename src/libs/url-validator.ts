/**
 * Validates and sanitizes redirect URLs to prevent open redirect attacks.
 * Only allows relative paths or same-origin URLs.
 *
 * @param url - The URL to validate (from user input or query params)
 * @param fallback - The fallback URL to use if validation fails
 * @returns A safe URL to redirect to
 */
export const validateRedirectUrl = (
  url: string | null | undefined,
  fallback: string
): string => {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return fallback;
  }

  // Block dangerous protocols that could execute code
  const dangerousProtocols = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "blob:",
  ];

  const lowerUrl = trimmedUrl.toLowerCase().replace(/\s/g, "");
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return fallback;
    }
  }

  // Block protocol-relative URLs (//evil.com)
  if (trimmedUrl.startsWith("//")) {
    return fallback;
  }

  // Allow relative paths starting with /
  if (trimmedUrl.startsWith("/")) {
    try {
      // Decode and re-check for protocol injection via encoding
      const decoded = decodeURIComponent(trimmedUrl);
      const decodedLower = decoded.toLowerCase().replace(/\s/g, "");

      // Re-check after decoding
      for (const protocol of dangerousProtocols) {
        if (decodedLower.startsWith(protocol)) {
          return fallback;
        }
      }

      // Block protocol-relative after decoding
      if (decoded.startsWith("//")) {
        return fallback;
      }

      return decoded;
    } catch {
      // Invalid encoding, use fallback
      return fallback;
    }
  }

  // For absolute URLs, verify same origin
  try {
    const targetUrl = new URL(trimmedUrl, window.location.origin);

    // Only allow same-origin redirects
    if (targetUrl.origin === window.location.origin) {
      return targetUrl.pathname + targetUrl.search + targetUrl.hash;
    }
  } catch {
    // Invalid URL format
  }

  // Blocked external URL or invalid format
  return fallback;
};
