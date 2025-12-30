# Security Vulnerability Report for TocToc Auth

This document details security vulnerabilities identified in the TocToc Auth library through a comprehensive security audit conducted on December 30, 2025.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 2 | Weak Cryptography, Open Redirect |
| HIGH | 2 | Token Storage via XSS, Missing Decryption Validation |
| MEDIUM | 5 | Missing CSRF, Race Conditions, Information Disclosure, Input Validation, Prototype Pollution |
| LOW | 4 | Timing Attacks, Client-Side Role Enforcement, Console Logging, Key Rotation |

---

## CRITICAL Vulnerabilities

### 1. Weak Cryptography Implementation

**File:** `src/services/crypto-service.ts` (lines 3-10)

**Current Code:**
```typescript
const encrypt = (data: string, key: string): string => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

const decrypt = (data: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(data, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};
```

**Vulnerabilities:**
1. **No explicit IV (Initialization Vector):** CryptoJS with passphrase mode uses OpenSSL's deprecated EVP_BytesToKey for key derivation with a random salt, but no explicit IV control. This creates weaker encryption.
2. **Weak Key Derivation:** Direct passphrase usage without proper PBKDF2/Argon2 key derivation.
3. **No Integrity Verification (HMAC):** No authentication tag to detect tampering. An attacker can modify encrypted data without detection.
4. **Silent Decryption Failures:** If decryption fails (wrong key, corrupted data), the function returns an empty string or garbage without throwing an error.

**Impact:** Tokens stored in localStorage can be:
- Decrypted via pattern analysis if same data is encrypted multiple times
- Tampered with undetected
- Exposed through brute-force if a weak encryption key is used

**Proposed Fix:**
```typescript
import CryptoJS from "crypto-js";

const ITERATION_COUNT = 100000;
const KEY_SIZE = 256 / 32; // 256 bits
const IV_SIZE = 128 / 8;   // 128 bits

const deriveKey = (password: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray => {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: ITERATION_COUNT,
    hasher: CryptoJS.algo.SHA256,
  });
};

const encrypt = (data: string, key: string): string => {
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
  const derivedKey = deriveKey(key, salt);

  const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Create HMAC for integrity verification
  const ciphertext = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  const hmac = CryptoJS.HmacSHA256(ciphertext, derivedKey);

  // Combine: salt + iv + hmac + ciphertext
  const combined = salt
    .concat(iv)
    .concat(hmac)
    .concat(encrypted.ciphertext);

  return combined.toString(CryptoJS.enc.Base64);
};

const decrypt = (data: string, key: string): string => {
  try {
    const combined = CryptoJS.enc.Base64.parse(data);
    const words = combined.words;

    // Extract components
    const salt = CryptoJS.lib.WordArray.create(words.slice(0, 4));
    const iv = CryptoJS.lib.WordArray.create(words.slice(4, 8));
    const storedHmac = CryptoJS.lib.WordArray.create(words.slice(8, 16));
    const ciphertext = CryptoJS.lib.WordArray.create(words.slice(16));

    const derivedKey = deriveKey(key, salt);

    // Verify HMAC before decryption
    const ciphertextBase64 = ciphertext.toString(CryptoJS.enc.Base64);
    const computedHmac = CryptoJS.HmacSHA256(ciphertextBase64, derivedKey);

    if (storedHmac.toString() !== computedHmac.toString()) {
      throw new Error("Data integrity check failed - possible tampering detected");
    }

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext } as CryptoJS.lib.CipherParams,
      derivedKey,
      { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );

    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) {
      throw new Error("Decryption failed - invalid key or corrupted data");
    }

    return result;
  } catch (error) {
    throw new Error("Decryption failed: " + (error instanceof Error ? error.message : "Unknown error"));
  }
};

export const cryptoService = {
  encrypt,
  decrypt,
};
```

---

### 2. Open Redirect Vulnerability

**Files:**
- `src/components/toctoc-redirect.tsx` (lines 54-55)
- `src/providers/toctoc-provider.tsx` (lines 102-109, 143-150)

**Current Code (toctoc-redirect.tsx):**
```typescript
const target = decodeURIComponent(redirectSearchParam ?? to);
navigate(target, { replace: true });
```

**Current Code (toctoc-provider.tsx):**
```typescript
const target = decodeURIComponent(
  searchParams.get("redirect") ??
    credentials?.redirectClientRoutes.afterSignIn ??
    ""
);
if (target) {
  navigate(target, { replace: true });
}
```

**Vulnerabilities:**
1. **Arbitrary URL Redirect:** The `redirect` parameter from the URL query string is used without validation, allowing attackers to redirect users to malicious sites.
2. **JavaScript Protocol Injection:** URLs like `javascript:alert(document.cookie)` can execute arbitrary JavaScript.
3. **Data URI Exploitation:** `data:text/html,<script>...</script>` can execute code.
4. **Phishing Attacks:** `https://evil.com/fake-login` can steal credentials.

**Attack Example:**
```
https://yourapp.com/login?redirect=https://evil.com/phishing-page
https://yourapp.com/login?redirect=javascript:alert(document.cookie)
```

**Impact:** Session hijacking, credential theft, malware distribution, phishing attacks.

**Proposed Fix:**

Create a new utility file `src/libs/url-validator.ts`:
```typescript
/**
 * Validates and sanitizes redirect URLs to prevent open redirect attacks.
 * Only allows relative paths or same-origin URLs.
 */
export const validateRedirectUrl = (
  url: string | null | undefined,
  fallback: string
): string => {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmedUrl = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "blob:",
  ];

  const lowerUrl = trimmedUrl.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      console.warn(`Blocked dangerous redirect URL: ${trimmedUrl}`);
      return fallback;
    }
  }

  // Allow relative paths starting with /
  if (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) {
    // Ensure no protocol injection via encoded characters
    const decoded = decodeURIComponent(trimmedUrl);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
      return decoded;
    }
  }

  // For absolute URLs, verify same origin
  try {
    const targetUrl = new URL(trimmedUrl, window.location.origin);
    if (targetUrl.origin === window.location.origin) {
      return targetUrl.pathname + targetUrl.search + targetUrl.hash;
    }
  } catch {
    // Invalid URL, use fallback
  }

  console.warn(`Blocked external redirect URL: ${trimmedUrl}`);
  return fallback;
};
```

**Update toctoc-redirect.tsx:**
```typescript
import { validateRedirectUrl } from "../libs/url-validator";

// In useEffect for shouldRedirectReverse (line 54):
const target = validateRedirectUrl(redirectSearchParam, to);
navigate(target, { replace: true });
```

**Update toctoc-provider.tsx:**
```typescript
import { validateRedirectUrl } from "../libs/url-validator";

// In signInWithCredentialsAsync (line 102):
const target = validateRedirectUrl(
  searchParams.get("redirect"),
  credentials?.redirectClientRoutes.afterSignIn ?? "/"
);

// In signUpWithCredentialsAsync (line 143):
const target = validateRedirectUrl(
  searchParams.get("redirect"),
  credentials?.redirectClientRoutes.afterSignUp ?? "/"
);
```

---

## HIGH Vulnerabilities

### 3. Token Exposure via XSS (localStorage-based storage)

**File:** `src/services/localStorage-service.ts`

**Vulnerability:** Tokens stored in localStorage are accessible to any JavaScript running on the page, including malicious scripts injected via XSS vulnerabilities.

**Impact:** If any XSS vulnerability exists in the application (or dependencies), attackers can steal tokens with:
```javascript
const tokens = localStorage.getItem('toctoc-auth');
// Send to attacker server
```

**Proposed Fix:**

This is an architectural consideration. While keeping localStorage, add these mitigations:

1. **Add Content Security Policy headers** (server-side recommendation in README):
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

2. **Add token binding** - Include a fingerprint in the token validation:
```typescript
// In localStorage-service.ts
const generateFingerprint = (): string => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("fingerprint", 2, 2);
  }
  return btoa(canvas.toDataURL()).slice(0, 32);
};

const setItem = <T>(cacheKey: string, value: T, encryptKey: string): void => {
  const fingerprint = generateFingerprint();
  const valueWithFingerprint = { ...value, __fp: fingerprint };
  const item = JSON.stringify(valueWithFingerprint);
  const encryptedItem = cryptoService.encrypt(item, encryptKey);
  localStorage.setItem(cacheKey, encryptedItem);
};

const getItem = <T>(cacheKey: string, encryptKey: string): T | null => {
  const item = localStorage.getItem(cacheKey);
  if (item === null) {
    return null;
  }

  try {
    const decryptedItem = cryptoService.decrypt(item, encryptKey);
    const parsed = JSON.parse(decryptedItem);

    // Verify fingerprint
    const currentFingerprint = generateFingerprint();
    if (parsed.__fp !== currentFingerprint) {
      console.warn("Token fingerprint mismatch - possible token theft");
      localStorage.removeItem(cacheKey);
      return null;
    }

    const { __fp, ...data } = parsed;
    return data as T;
  } catch (error) {
    console.warn("Failed to decrypt stored data");
    localStorage.removeItem(cacheKey);
    return null;
  }
};
```

3. **Document HttpOnly cookie alternative** for high-security deployments.

---

### 4. Missing Decryption Error Handling

**File:** `src/services/localStorage-service.ts` (line 9-10)

**Current Code:**
```typescript
const decryptedItem = cryptoService.decrypt(item, encryptKey);
return JSON.parse(decryptedItem) as T;
```

**Vulnerability:** If decryption fails or returns invalid data:
- `JSON.parse()` throws, potentially crashing the app
- Silent failures could lead to undefined behavior
- Corrupted storage data causes application crashes

**Proposed Fix:**
```typescript
const getItem = <T>(cacheKey: string, encryptKey: string): T | null => {
  const item = localStorage.getItem(cacheKey);
  if (item === null) {
    return null;
  }

  try {
    const decryptedItem = cryptoService.decrypt(item, encryptKey);

    if (!decryptedItem || decryptedItem.trim() === "") {
      console.warn(`Decryption returned empty result for key: ${cacheKey}`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    return JSON.parse(decryptedItem) as T;
  } catch (error) {
    console.warn(`Failed to decrypt/parse stored item for key: ${cacheKey}`);
    // Remove corrupted data
    localStorage.removeItem(cacheKey);
    return null;
  }
};
```

---

## MEDIUM Vulnerabilities

### 5. Missing CSRF Protection

**File:** `src/services/credentials-service.ts` (lines 23-29, 70-76, 174-180)

**Current Code:**
```typescript
fetch(`${baseUrl}${path}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
})
```

**Vulnerability:** No CSRF token is included in requests. While modern browsers have SameSite cookie protections, applications using this library may be vulnerable to CSRF attacks.

**Proposed Fix:**

Add CSRF token support to configuration and requests:

```typescript
// In TocTocAuthConfig type (toctoc-provider.tsx)
export type TocTocAuthConfig = {
  // ... existing fields
  csrf?: {
    enabled: boolean;
    headerName?: string;    // Default: "X-CSRF-Token"
    cookieName?: string;    // Default: "csrf-token"
    tokenEndpoint?: string; // Optional endpoint to fetch CSRF token
  };
};

// In credentials-service.ts
const getCsrfToken = (config: TocTocAuthConfig): string | null => {
  if (!config.csrf?.enabled) return null;

  const cookieName = config.csrf.cookieName ?? "csrf-token";
  const match = document.cookie.match(new RegExp(`(^| )${cookieName}=([^;]+)`));
  return match ? match[2] : null;
};

const buildHeaders = (config: TocTocAuthConfig): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const csrfToken = getCsrfToken(config);
  if (csrfToken) {
    const headerName = config.csrf?.headerName ?? "X-CSRF-Token";
    headers[headerName] = csrfToken;
  }

  return headers;
};

// Update fetch calls:
fetch(`${baseUrl}${path}`, {
  method: "POST",
  headers: buildHeaders(config),
  credentials: "same-origin", // Include cookies
  body: JSON.stringify(data),
})
```

---

### 6. Race Condition in Token Refresh

**File:** `src/services/refresh-manager.ts` (lines 22-26)

**Current Code:**
```typescript
if (this.refreshState.isRefreshing && this.refreshState.promise) {
  return this.refreshState.promise as Promise<TocTocResult<TResponse>>;
}

this.refreshState.isRefreshing = true;
this.refreshState.promise = this.performRefresh(...);
```

**Vulnerability:** Between checking `isRefreshing` and setting it to `true`, multiple concurrent calls could pass the check simultaneously (race condition).

**Proposed Fix:**
```typescript
export class RefreshTokenManager {
  private refreshState: RefreshState = {
    promise: null,
    isRefreshing: false,
  };
  private pendingRefresh: Promise<TocTocResult<any>> | null = null;

  async refresh<TResponse>(
    config: TocTocAuthConfig,
    refreshToken: string,
    refreshFn: (
      config: TocTocAuthConfig,
      token: string
    ) => Promise<TocTocResult<TResponse>>
  ): Promise<TocTocResult<TResponse>> {
    // If there's already a pending refresh, return it
    if (this.pendingRefresh) {
      return this.pendingRefresh as Promise<TocTocResult<TResponse>>;
    }

    // Create the refresh promise immediately to prevent race conditions
    this.pendingRefresh = (async () => {
      try {
        this.refreshState.isRefreshing = true;
        return await this.performRefresh(config, refreshToken, refreshFn);
      } finally {
        this.refreshState.isRefreshing = false;
        // Small delay before clearing to handle near-simultaneous requests
        setTimeout(() => {
          this.pendingRefresh = null;
        }, 100);
      }
    })();

    this.refreshState.promise = this.pendingRefresh;
    return this.pendingRefresh as Promise<TocTocResult<TResponse>>;
  }

  // ... rest of the class
}
```

---

### 7. Information Disclosure via Error Messages

**Files:**
- `src/services/credentials-service.ts` (multiple locations)
- `src/components/toctoc-guard.tsx` (lines 26-32, 43-50)

**Vulnerability:** Error messages expose internal API structure and configuration details:
```typescript
throw new Error(
  `The response body from '${nameOf(...)}' endpoint does not contain ` +
  `the expected '${accessTokenPath.join(".")}' property...`
);
```

**Impact:** Attackers can learn:
- API endpoint naming conventions
- Expected response structure
- Internal configuration property names

**Proposed Fix:**

Create environment-aware error messages:

```typescript
// In libs/error-utils.ts
const isDevelopment = process.env.NODE_ENV === "development";

export const createConfigError = (
  developerMessage: string,
  userMessage: string = "Authentication configuration error. Please contact support."
): Error => {
  if (isDevelopment) {
    return new Error(developerMessage);
  }
  console.error("[TocToc Auth] Config Error:", developerMessage);
  return new Error(userMessage);
};

// In credentials-service.ts
if (!hasNestedProperty(body, accessTokenPath)) {
  throw createConfigError(
    `Response from '${nameOf(() => config.providers.credentials?.signInApiRoute)}' ` +
    `missing '${accessTokenPath.join(".")}' property`,
    "Authentication failed. Please try again."
  );
}
```

---

### 8. Insufficient Input Validation

**File:** `src/services/credentials-service.ts` (lines 8, 47)

**Current Code:**
```typescript
const registerAsync = async <TResponse>(
  config: TocTocAuthConfig,
  data: object  // No validation
): Promise<TocTocResult<TResponse>> => {
```

**Vulnerabilities:**
1. No runtime validation of user input
2. Potential prototype pollution via `__proto__` properties
3. Circular reference could cause `JSON.stringify` to throw

**Proposed Fix:**

```typescript
// In libs/input-validator.ts
export const sanitizeInput = (data: unknown): object => {
  if (data === null || data === undefined) {
    throw new Error("Input data is required");
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Input must be a plain object");
  }

  // Create a clean copy without prototype pollution vectors
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Block prototype pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }

    // Recursively sanitize nested objects
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

// In credentials-service.ts
const registerAsync = async <TResponse>(
  config: TocTocAuthConfig,
  data: object
): Promise<TocTocResult<TResponse>> => {
  const sanitizedData = sanitizeInput(data);
  // ... rest of function using sanitizedData
```

---

### 9. Prototype Pollution in Utility Functions

**File:** `src/libs/utils.ts` (lines 17-31, 33-51)

**Current Code:**
```typescript
const hasNestedProperty = (obj: any, path: string[]): boolean => {
  let current = obj;
  for (const key of path) {
    // ...
    current = current[key];
  }
  return true;
};
```

**Vulnerability:** Accessing properties via bracket notation without validation could traverse prototype chain.

**Proposed Fix:**
```typescript
const hasNestedProperty = (obj: any, path: string[]): boolean => {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  let current = obj;
  for (const key of path) {
    // Block prototype chain traversal
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return false;
    }

    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return false;
    }
    current = current[key];
  }
  return true;
};

const getNestedProperty = <T>(obj: any, path: string[]): T | undefined => {
  if (path.length === 0 || !obj || typeof obj !== "object") {
    return undefined;
  }

  let current = obj;
  for (const key of path) {
    // Block prototype chain traversal
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return undefined;
    }

    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return undefined;
    }
    current = current[key];
  }
  return current as T;
};
```

---

## LOW Vulnerabilities

### 10. Console Logging Leaks Information

**File:** `src/services/toctoc-wrapper.ts` (lines 53, 101, 104)

**Current Code:**
```typescript
console.warn("Failed to refresh token. Clearing session.");
console.warn("No refresh token available. Clearing session.");
console.error("Error refreshing token:", refreshError);
```

**Vulnerability:** Console logs in production expose:
- Session state information
- Token refresh failure details
- Error objects with potential stack traces

**Proposed Fix:**
```typescript
// In libs/logger.ts
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = {
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(`[TocToc Auth] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.error(`[TocToc Auth] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.info(`[TocToc Auth] ${message}`, ...args);
    }
  },
};

// In toctoc-wrapper.ts
import { logger } from "../libs/logger";

// Replace console.warn/error with:
logger.warn("Failed to refresh token. Clearing session.");
```

---

### 11. Client-Side Role Enforcement Only

**File:** `src/components/toctoc-guard.tsx` (lines 54-85)

**Vulnerability:** Role-based access control relies solely on client-side checks:
```typescript
const canAccess = allowedRoles.includes(currentRole!);
if (canAccess) return <>{children}</>;

return (
  <div style={{ filter: `blur(${blurRadius}px)` }}>
    {children}
  </div>
);
```

**Issues:**
1. CSS blur can be disabled via DevTools
2. Content is still rendered in DOM
3. React DevTools exposes all state

**Proposed Fix:**

The fix is primarily documentation and best practices. Update the component:

```typescript
export const TocTocGuard = <TRole,>({
  children,
  blurRadius = 3,
  style,
  lockIcon,
  allowedRoles,
  hideContent = false, // NEW: Option to not render content at all
}: TocTocGuardProps<TRole>): JSX.Element | null => {
  // ... existing validation

  const currentRole = utils.getNestedProperty<TRole>(getUser(), roleLocation);
  const canAccess = allowedRoles.includes(currentRole!);

  if (canAccess) return <>{children}</>;

  // If hideContent is true, don't render protected content at all
  if (hideContent) {
    return (
      <div style={{ ...style }}>
        {lockIcon ?? <span>Access Restricted</span>}
      </div>
    );
  }

  // Blur mode (visual indicator only - NOT security)
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      {/* ... existing blur implementation */}
    </div>
  );
};
```

Add JSDoc warning:
```typescript
/**
 * TocTocGuard provides client-side role-based UI protection.
 *
 * @warning This is a UX feature, NOT a security control.
 * Always enforce authorization server-side. This component only hides
 * UI elements and should not protect sensitive data.
 */
```

---

### 12. Timing Attack on Role Check

**File:** `src/components/toctoc-guard.tsx` (line 54)

**Vulnerability:** `Array.includes()` has variable timing based on position.

**Note:** This is theoretical and extremely difficult to exploit in practice.

**Proposed Fix (if high-security is required):**
```typescript
// Constant-time comparison for role checking
const constantTimeIncludes = <T>(array: T[], value: T): boolean => {
  let result = 0;
  for (const item of array) {
    result |= (item === value ? 1 : 0);
  }
  return result === 1;
};

const canAccess = constantTimeIncludes(allowedRoles, currentRole!);
```

---

### 13. No Encryption Key Rotation Support

**Vulnerability:** The encryption key is static with no mechanism for rotation.

**Proposed Fix:**

Add key versioning support:

```typescript
// In TocTocAuthConfig
export type TocTocAuthConfig = {
  encryptionKey: string;
  previousEncryptionKey?: string; // For migration
  // ...
};

// In localStorage-service.ts
const getItem = <T>(
  cacheKey: string,
  encryptKey: string,
  previousKey?: string
): T | null => {
  const item = localStorage.getItem(cacheKey);
  if (item === null) return null;

  try {
    // Try current key first
    const decrypted = cryptoService.decrypt(item, encryptKey);
    return JSON.parse(decrypted) as T;
  } catch {
    // Try previous key for migration
    if (previousKey) {
      try {
        const decrypted = cryptoService.decrypt(item, previousKey);
        const parsed = JSON.parse(decrypted) as T;

        // Re-encrypt with new key
        setItem(cacheKey, parsed, encryptKey);

        return parsed;
      } catch {
        // Both keys failed
      }
    }

    localStorage.removeItem(cacheKey);
    return null;
  }
};
```

---

## Additional Recommendations

### 1. Add Security Headers Documentation

Document recommended HTTP security headers for applications using this library:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

### 2. Token Expiration Validation

Add client-side JWT expiration checking:
```typescript
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};
```

### 3. Add Rate Limiting Guidance

Document that servers should implement rate limiting on auth endpoints to prevent brute-force attacks.

### 4. Implement Secure Token Clearing

When signing out, ensure tokens are properly cleared:
```typescript
const signOutAsync = useCallback(async () => {
  // Clear from memory
  setAuthContent(null);

  // Clear from storage
  localStorageService.removeItem(TOCTOC_AUTH_CACHE_KEY);

  // Clear from sessionStorage as well
  sessionStorage.removeItem(TOCTOC_AUTH_CACHE_KEY);

  // Navigate
  if (credentials?.redirectClientRoutes.afterSignOut) {
    navigate(credentials.redirectClientRoutes.afterSignOut, { replace: true });
  }
}, [credentials, navigate]);
```

---

## Implementation Priority

1. **Immediate (Critical):**
   - Fix open redirect vulnerability
   - Upgrade cryptography implementation

2. **Short-term (High):**
   - Add decryption error handling
   - Add input validation and sanitization

3. **Medium-term (Medium):**
   - Implement CSRF protection
   - Fix race condition in refresh manager
   - Sanitize error messages for production

4. **Long-term (Low):**
   - Add token fingerprinting
   - Implement key rotation
   - Add comprehensive logging controls
   - Document security best practices

---

## Testing Recommendations

After implementing fixes, test for:

1. **Open Redirect:**
   - `?redirect=https://evil.com`
   - `?redirect=javascript:alert(1)`
   - `?redirect=//evil.com`
   - `?redirect=%2f%2fevil.com`

2. **Cryptography:**
   - Encrypt same data twice, verify different ciphertext
   - Tamper with ciphertext, verify detection
   - Use wrong key, verify graceful failure

3. **Race Conditions:**
   - Fire 100 simultaneous requests triggering token refresh
   - Verify only one refresh request is made

4. **Input Validation:**
   - Submit `{"__proto__": {"admin": true}}`
   - Submit circular references
   - Submit null/undefined values
