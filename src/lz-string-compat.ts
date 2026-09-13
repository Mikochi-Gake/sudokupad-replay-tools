/*
 * Bounded compatibility implementation for LZ-String Base64 decompression.
 * Algorithm compatibility derives from LZ-String by Pieroxy (MIT).
 * See THIRD_PARTY_NOTICES.md.
 */
import { ReplayError } from './errors.js';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function decompressFromBase64Bounded(input: string, maxOutputChars: number): string {
  if (input.length === 0) return '';
  const values = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const value = BASE64.indexOf(input[i]);
    if (value < 0) {
      throw new ReplayError('INVALID_CLZW', 'Compressed data contains a non-Base64 character.', { offset: i });
    }
    values[i] = value;
  }

  const dictionary: string[] = ['', '', ''];
  let dictionarySize = 4;
  let bitsPerCode = 3;
  let codesUntilGrowth = 4;
  let valueIndex = 1;
  let bitMask = 32;
  let currentValue = values[0];
  let operations = 0;
  const operationLimit = Math.max(input.length * 64, maxOutputChars * 8);

  const readBits = (count: number): number => {
    let result = 0;
    let place = 1;
    const end = 2 ** count;
    while (place !== end) {
      operations += 1;
      if (operations > operationLimit) {
        throw new ReplayError('INVALID_CLZW', 'Compressed data exceeded the decoding work limit.');
      }
      const bit = currentValue & bitMask;
      bitMask >>= 1;
      if (bitMask === 0) {
        bitMask = 32;
        currentValue = valueIndex < values.length ? values[valueIndex] : 0;
        valueIndex += 1;
      }
      if (bit !== 0) result |= place;
      place <<= 1;
    }
    return result;
  };

  const readLiteral = (kind: number): string => {
    if (kind === 0) return String.fromCharCode(readBits(8));
    if (kind === 1) return String.fromCharCode(readBits(16));
    if (kind === 2) return '';
    throw new ReplayError('INVALID_CLZW', 'Compressed data begins with an invalid code.');
  };

  const firstKind = readBits(2);
  if (firstKind === 2) return '';
  let previous = readLiteral(firstKind);
  dictionary[3] = previous;
  const output: string[] = [previous];
  let outputLength = previous.length;

  const append = (text: string) => {
    outputLength += text.length;
    if (outputLength > maxOutputChars) {
      throw new ReplayError('DECOMPRESSED_LIMIT', 'Decompressed data exceeds the configured limit.', {
        maxOutputChars,
      });
    }
    output.push(text);
  };

  while (valueIndex <= values.length) {
    let code = readBits(bitsPerCode);
    if (code === 0 || code === 1) {
      const literal = readLiteral(code);
      dictionary[dictionarySize] = literal;
      code = dictionarySize;
      dictionarySize += 1;
      codesUntilGrowth -= 1;
    } else if (code === 2) {
      return output.join('');
    }

    if (codesUntilGrowth === 0) {
      codesUntilGrowth = 2 ** bitsPerCode;
      bitsPerCode += 1;
    }

    let entry: string;
    if (dictionary[code] !== undefined) entry = dictionary[code];
    else if (code === dictionarySize) entry = previous + previous[0];
    else throw new ReplayError('INVALID_CLZW', 'Compressed data references an invalid dictionary entry.', { code });

    append(entry);
    dictionary[dictionarySize] = previous + entry[0];
    dictionarySize += 1;
    codesUntilGrowth -= 1;
    previous = entry;

    if (codesUntilGrowth === 0) {
      codesUntilGrowth = 2 ** bitsPerCode;
      bitsPerCode += 1;
    }
  }

  throw new ReplayError('INVALID_CLZW', 'Compressed data ended before the terminal code.');
}
