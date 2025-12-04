declare module 'base-64' {
  /**
   * Encodes a string to Base64.
   * @param input The string to encode.
   * @returns The Base64-encoded string.
   */
  export function encode(input: string): string;

  /**
   * Decodes a Base64-encoded string.
   * @param input The Base64-encoded string to decode.
   * @returns The decoded string.
   */
  export function decode(input: string): string;

  /**
   * The version of the base-64 library.
   */
  export const version: string;
}