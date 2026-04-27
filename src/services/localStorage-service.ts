import { cryptoService } from ".";

const FINGERPRINT_KEY = "__fp";

/**
 * Generates a browser fingerprint for token binding.
 * This helps detect if tokens are being used from a different browser/device.
 */
const generateFingerprint = (): string => {
  try {
    const components: string[] = [];

    // User agent
    components.push(navigator.userAgent);

    // Screen properties
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Language
    components.push(navigator.language);

    // Platform
    components.push(navigator.platform);

    // Canvas fingerprint
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("toctoc-fp", 2, 15);
      components.push(canvas.toDataURL());
    }

    // Create a hash of all components
    const fingerprint = components.join("|");
    return btoa(fingerprint).slice(0, 64);
  } catch {
    // Fallback to a simpler fingerprint if canvas is not available
    return btoa(
      `${navigator.userAgent}|${screen.width}|${navigator.language}`
    ).slice(0, 64);
  }
};

type DecryptCacheEntry = {
  ciphertext: string;
  encryptKey: string;
  value: unknown;
};
const decryptCache = new Map<string, DecryptCacheEntry>();

const cacheLookupKey = (cacheKey: string, encryptKey: string): string =>
  `${cacheKey}${encryptKey}`;

/**
 * Retrieves and decrypts an item from localStorage.
 * Validates fingerprint to detect potential token theft.
 *
 * Decrypted values are memoized in module memory keyed by the raw ciphertext,
 * so repeated reads of an unchanged value skip PBKDF2 + AES-CBC.
 *
 * @returns The decrypted item or null if not found, corrupted, or fingerprint mismatch
 */
const getItem = <T>(cacheKey: string, encryptKey: string): T | null => {
  const lookup = cacheLookupKey(cacheKey, encryptKey);
  const item = localStorage.getItem(cacheKey);
  if (item === null) {
    decryptCache.delete(lookup);
    return null;
  }

  const cached = decryptCache.get(lookup);
  if (
    cached !== undefined &&
    cached.ciphertext === item &&
    cached.encryptKey === encryptKey
  ) {
    return cached.value as T | null;
  }

  try {
    const decryptedItem = cryptoService.decrypt(item, encryptKey);

    if (!decryptedItem || decryptedItem.trim() === "") {
      localStorage.removeItem(cacheKey);
      decryptCache.delete(lookup);
      return null;
    }

    const parsed = JSON.parse(decryptedItem);

    // Verify fingerprint if present
    if (parsed && typeof parsed === "object" && FINGERPRINT_KEY in parsed) {
      const storedFingerprint = parsed[FINGERPRINT_KEY];
      const currentFingerprint = generateFingerprint();

      if (storedFingerprint !== currentFingerprint) {
        // Fingerprint mismatch - possible token theft or browser change
        localStorage.removeItem(cacheKey);
        decryptCache.delete(lookup);
        return null;
      }

      // Remove fingerprint from returned data
      const { [FINGERPRINT_KEY]: _, ...data } = parsed;
      decryptCache.set(lookup, { ciphertext: item, encryptKey, value: data });
      return data as T;
    }

    decryptCache.set(lookup, { ciphertext: item, encryptKey, value: parsed });
    return parsed as T;
  } catch {
    // Decryption or parsing failed - remove corrupted data
    localStorage.removeItem(cacheKey);
    decryptCache.delete(lookup);
    return null;
  }
};

/**
 * Encrypts and stores an item in localStorage.
 * Adds a browser fingerprint to the data for token binding.
 */
const setItem = <T>(cacheKey: string, value: T, encryptKey: string): void => {
  const fingerprint = generateFingerprint();
  const valueWithFingerprint = {
    ...(value as object),
    [FINGERPRINT_KEY]: fingerprint,
  };
  const item = JSON.stringify(valueWithFingerprint);
  const encryptedItem = cryptoService.encrypt(item, encryptKey);
  localStorage.setItem(cacheKey, encryptedItem);

  decryptCache.set(cacheLookupKey(cacheKey, encryptKey), {
    ciphertext: encryptedItem,
    encryptKey,
    value: value as unknown,
  });
};

/**
 * Removes an item from localStorage.
 */
const removeItem = (key: string): void => {
  localStorage.removeItem(key);
  const prefix = `${key}`;
  for (const lookup of decryptCache.keys()) {
    if (lookup.startsWith(prefix)) {
      decryptCache.delete(lookup);
    }
  }
};

export const localStorageService = {
  getItem,
  setItem,
  removeItem,
};
