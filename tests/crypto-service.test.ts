const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import CryptoJS from "crypto-js";
import { cryptoService } from "../src/services/crypto-service";
import { localStorageService } from "../src/services/localStorage-service";

const key = "test passphrase";

// Reproduce the previous on-disk format to verify the upgrade policy.
const legacyRecord = (value: string) => {
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);
  const derived = CryptoJS.PBKDF2(key, salt, { keySize: 8, iterations: 100000, hasher: CryptoJS.algo.SHA256 });
  const ciphertext = CryptoJS.AES.encrypt(value, derived, { iv }).ciphertext;
  const mac = CryptoJS.HmacSHA256(ciphertext.toString(CryptoJS.enc.Hex), derived);
  return salt.concat(iv).concat(mac).concat(ciphertext).toString(CryptoJS.enc.Base64);
};

test("new records round-trip and reject a wrong key", () => {
  const record = cryptoService.encrypt('{"accessToken":"secret"}', key);
  assert.ok(record.startsWith("toctoc:v2:"));
  assert.equal(cryptoService.decrypt(record, key), '{"accessToken":"secret"}');
  assert.throws(() => cryptoService.decrypt(record, "wrong"));
});

test("rejects changes to version, salt, IV, ciphertext and MAC", () => {
  const record = cryptoService.encrypt("protected data", key);
  const prefix = "toctoc:v2:";
  const bytes = Buffer.from(record.slice(prefix.length), "base64");
  assert.throws(() => cryptoService.decrypt(record.replace("v2", "v3"), key));
  for (const offset of [0, 16, 32, bytes.length - 1]) {
    const modified = Buffer.from(bytes);
    modified[offset] ^= 1;
    assert.throws(() => cryptoService.decrypt(prefix + modified.toString("base64"), key));
  }
  assert.throws(() => cryptoService.decrypt(record + "!", key));
  assert.throws(() => cryptoService.decrypt(prefix + bytes.subarray(0, bytes.length - 1).toString("base64"), key));
});

test("legacy sessions are discarded and require sign-in", () => {
  const old = legacyRecord('{"accessToken":"old","refreshToken":"old-refresh"}');
  assert.throws(() => cryptoService.decrypt(old, key));
  const records = new Map([["legacy-session", old]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (name: string) => records.get(name) ?? null,
    removeItem: (name: string) => records.delete(name),
  }});
  try {
    assert.equal(localStorageService.getItem("legacy-session", key), null);
    assert.equal(records.has("legacy-session"), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});
