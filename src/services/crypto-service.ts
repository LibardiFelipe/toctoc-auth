import CryptoJS from "crypto-js";

const ITERATION_COUNT = 100000;
const KEY_SIZE = 256 / 32; // 256 bits (8 words)
const SALT_SIZE = 16; // 16 bytes (4 words)
const IV_SIZE = 16; // 16 bytes (4 words)
const HMAC_SIZE = 32; // 32 bytes (8 words)

/**
 * Derives a cryptographic key from a password using PBKDF2.
 */
const deriveKey = (
  password: string,
  salt: CryptoJS.lib.WordArray
): CryptoJS.lib.WordArray => {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: ITERATION_COUNT,
    hasher: CryptoJS.algo.SHA256,
  });
};

/**
 * Encrypts data using AES-256-CBC with PBKDF2 key derivation and HMAC integrity.
 *
 * Output format: Base64(salt[16] + iv[16] + hmac[32] + ciphertext)
 */
const encrypt = (data: string, key: string): string => {
  const salt = CryptoJS.lib.WordArray.random(SALT_SIZE);
  const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
  const derivedKey = deriveKey(key, salt);

  const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Create HMAC for integrity verification (encrypt-then-MAC)
  const ciphertextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
  const hmac = CryptoJS.HmacSHA256(ciphertextHex, derivedKey);

  // Combine: salt + iv + hmac + ciphertext
  const combined = salt.concat(iv).concat(hmac).concat(encrypted.ciphertext);

  return combined.toString(CryptoJS.enc.Base64);
};

/**
 * Decrypts data encrypted with the encrypt function.
 * Verifies HMAC integrity before decryption.
 *
 * @throws Error if decryption fails or integrity check fails
 */
const decrypt = (data: string, key: string): string => {
  const combined = CryptoJS.enc.Base64.parse(data);

  // Minimum size: salt(4) + iv(4) + hmac(8) + at least 1 word of ciphertext
  if (combined.sigBytes < SALT_SIZE + IV_SIZE + HMAC_SIZE + 4) {
    throw new Error("Decryption failed: invalid data format");
  }

  const words = combined.words;
  const saltWords = 4; // 16 bytes / 4 bytes per word
  const ivWords = 4; // 16 bytes / 4 bytes per word
  const hmacWords = 8; // 32 bytes / 4 bytes per word

  // Extract components
  const salt = CryptoJS.lib.WordArray.create(
    words.slice(0, saltWords),
    SALT_SIZE
  );
  const iv = CryptoJS.lib.WordArray.create(
    words.slice(saltWords, saltWords + ivWords),
    IV_SIZE
  );
  const storedHmac = CryptoJS.lib.WordArray.create(
    words.slice(saltWords + ivWords, saltWords + ivWords + hmacWords),
    HMAC_SIZE
  );
  const ciphertext = CryptoJS.lib.WordArray.create(
    words.slice(saltWords + ivWords + hmacWords),
    combined.sigBytes - SALT_SIZE - IV_SIZE - HMAC_SIZE
  );

  const derivedKey = deriveKey(key, salt);

  // Verify HMAC before decryption (prevents padding oracle attacks)
  const ciphertextHex = ciphertext.toString(CryptoJS.enc.Hex);
  const computedHmac = CryptoJS.HmacSHA256(ciphertextHex, derivedKey);

  if (storedHmac.toString() !== computedHmac.toString()) {
    throw new Error(
      "Decryption failed: data integrity check failed - possible tampering"
    );
  }

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertext } as CryptoJS.lib.CipherParams,
    derivedKey,
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );

  const result = decrypted.toString(CryptoJS.enc.Utf8);
  if (!result) {
    throw new Error("Decryption failed: invalid key or corrupted data");
  }

  return result;
};

export const cryptoService = {
  encrypt,
  decrypt,
};
