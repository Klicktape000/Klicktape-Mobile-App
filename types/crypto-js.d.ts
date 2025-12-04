declare module 'crypto-js' {
  export interface WordArray {
    words: number[];
    sigBytes: number;
    toString(encoder?: any): string;
  }

  export interface CipherParams {
    ciphertext: WordArray;
    key?: WordArray;
    iv?: WordArray;
    salt?: WordArray;
    algorithm?: any;
    mode?: any;
    padding?: any;
    blockSize?: number;
    formatter?: any;
  }

  export interface Cipher {
    encrypt(message: string | WordArray, key: string | WordArray, cfg?: any): CipherParams;
    decrypt(cipherParams: CipherParams | string, key: string | WordArray, cfg?: any): WordArray;
  }

  export const AES: Cipher;
  export const DES: Cipher;
  export const TripleDES: Cipher;
  export const Rabbit: Cipher;
  export const RC4: Cipher;
  export const RC4Drop: Cipher;

  export interface Hasher {
    (message: string | WordArray, key?: string | WordArray): WordArray;
  }

  export const MD5: Hasher;
  export const SHA1: Hasher;
  export const SHA256: Hasher;
  export const SHA224: Hasher;
  export const SHA512: Hasher;
  export const SHA384: Hasher;
  export const SHA3: Hasher;
  export const RIPEMD160: Hasher;

  export const HmacMD5: Hasher;
  export const HmacSHA1: Hasher;
  export const HmacSHA256: Hasher;
  export const HmacSHA224: Hasher;
  export const HmacSHA512: Hasher;
  export const HmacSHA384: Hasher;
  export const HmacSHA3: Hasher;
  export const HmacRIPEMD160: Hasher;

  export const PBKDF2: (password: string | WordArray, salt: string | WordArray, cfg?: any) => WordArray;

  export const enc: {
    Hex: any;
    Latin1: any;
    Utf8: any;
    Base64: any;
    Base64url: any;
  };

  export const lib: {
    WordArray: {
      create(words?: number[], sigBytes?: number): WordArray;
      random(nBytes: number): WordArray;
    };
    CipherParams: {
      create(cipherParams?: any): CipherParams;
    };
  };

  export const format: {
    OpenSSL: any;
    Hex: any;
  };

  export const algo: any;
  export const mode: any;
  export const pad: any;
}