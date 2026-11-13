import CryptoJS from "crypto-js";

const VERSION = "toctoc:v2:";
const ITERATION_COUNT = 100000;
const KEY_WORDS = 256 / 32;
const SALT_SIZE = 16;
const IV_SIZE = 16;
const HMAC_SIZE = 32;
const BLOCK_SIZE = 16;

// Derive independent encryption and authentication keys from the same salt.
const deriveKeys = (password: string, salt: CryptoJS.lib.WordArray) => {
  const material = CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_WORDS * 2,
    iterations: ITERATION_COUNT,
    hasher: CryptoJS.algo.SHA256,
  });
  return {
    encryption: CryptoJS.lib.WordArray.create(material.words.slice(0, KEY_WORDS), 32),
    authentication: CryptoJS.lib.WordArray.create(material.words.slice(KEY_WORDS), 32),
  };
};

const slice = (data: CryptoJS.lib.WordArray, start: number, length: number) =>
  CryptoJS.lib.WordArray.create(data.words.slice(start / 4, (start + length) / 4), length);

// The version is included in the MAC along with the salt, IV and ciphertext.
const authenticate = (payload: CryptoJS.lib.WordArray, key: CryptoJS.lib.WordArray) =>
  CryptoJS.HmacSHA256(CryptoJS.enc.Utf8.parse(VERSION).concat(payload.clone()), key);

/** Creates a versioned encrypt-then-MAC record: version + Base64(salt || IV || ciphertext || MAC). */
const encrypt = (data: string, key: string): string => {
  const salt = CryptoJS.lib.WordArray.random(SALT_SIZE);
  const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
  const keys = deriveKeys(key, salt);
  const ciphertext = CryptoJS.AES.encrypt(data, keys.encryption, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext;
  const payload = salt.clone().concat(iv).concat(ciphertext);
  return VERSION + payload.concat(authenticate(payload, keys.authentication)).toString(CryptoJS.enc.Base64);
};

/** Rejects legacy and unknown formats, then verifies the complete record before decrypting. */
const decrypt = (data: string, key: string): string => {
  if (!data.startsWith(VERSION)) {
    throw new Error("Decryption failed: unsupported storage format; sign in again");
  }
  const encoded = data.slice(VERSION.length);
  // CryptoJS's Base64 parser is permissive, so require a canonical encoding.
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error("Decryption failed: invalid data format");
  }
  const combined = CryptoJS.enc.Base64.parse(encoded);
  const payloadSize = combined.sigBytes - HMAC_SIZE;
  const ciphertextSize = payloadSize - SALT_SIZE - IV_SIZE;
  if (ciphertextSize < BLOCK_SIZE || ciphertextSize % BLOCK_SIZE !== 0 ||
      combined.toString(CryptoJS.enc.Base64) !== encoded) {
    throw new Error("Decryption failed: invalid data format");
  }

  const payload = slice(combined, 0, payloadSize);
  const salt = slice(payload, 0, SALT_SIZE);
  const iv = slice(payload, SALT_SIZE, IV_SIZE);
  const ciphertext = slice(payload, SALT_SIZE + IV_SIZE, ciphertextSize);
  const storedHmac = slice(combined, payloadSize, HMAC_SIZE);
  const keys = deriveKeys(key, salt);
  const expectedHmac = authenticate(payload, keys.authentication);
  let difference = 0;
  for (let i = 0; i < HMAC_SIZE / 4; i++) {
    difference |= storedHmac.words[i] ^ expectedHmac.words[i];
  }
  if (difference !== 0) {
    throw new Error("Decryption failed: data integrity check failed");
  }

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext } as CryptoJS.lib.CipherParams,
    keys.encryption,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  ).toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new Error("Decryption failed: invalid key or corrupted data");
  }
  return decrypted;
};

export const cryptoService = { encrypt, decrypt };
