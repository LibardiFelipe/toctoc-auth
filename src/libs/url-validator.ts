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

  // URL parsers can discard ASCII controls, changing the meaning of the URL.
  if (/[\u0000-\u001f\u007f]/.test(trimmedUrl)) return fallback;

  // Allow relative paths starting with /
  if (trimmedUrl.startsWith("/")) {
    try {
      // Inspect only the path; decoding the returned query would change its values.
      const path = trimmedUrl.split(/[?#]/, 1)[0];
      const decodedPath = decodeURIComponent(path);
      if (decodedPath.startsWith("//") || decodedPath.startsWith("/\\") ||
          path.includes("\\") || /[\u0000-\u001f\u007f]/.test(decodedPath)) return fallback;
      // Browsers treat backslashes as slashes for HTTP(S) URLs.
      if (new URL(trimmedUrl, "https://toctoc.invalid").origin !== "https://toctoc.invalid") return fallback;
      return trimmedUrl;
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
      return validateRedirectUrl(targetUrl.pathname + targetUrl.search + targetUrl.hash, fallback);
    }
  } catch {
    // Invalid URL format
  }

  // Blocked external URL or invalid format
  return fallback;
};
