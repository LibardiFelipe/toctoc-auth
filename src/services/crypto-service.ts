import CryptoJS from "crypto-js";

const encrypt = (data: string, key: string): string => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

const decrypt = (data: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(data, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const cryptoService = {
  encrypt,
  decrypt,
};
