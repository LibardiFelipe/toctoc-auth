import { cryptoService } from ".";

const getItem = <T>(cacheKey: string, encryptKey: string): T | null => {
  const item = localStorage.getItem(cacheKey);
  if (item === null) {
    return null;
  }

  const decryptedItem = cryptoService.decrypt(item, encryptKey);
  return JSON.parse(decryptedItem) as T;
};

const setItem = <T>(cacheKey: string, value: T, encryptKey: string): void => {
  const item = JSON.stringify(value);
  const encryptedItem = cryptoService.encrypt(item, encryptKey);
  localStorage.setItem(cacheKey, encryptedItem);
};

const removeItem = (key: string): void => {
  localStorage.removeItem(key);
};

export const localStorageService = {
  getItem,
  setItem,
  removeItem,
};
