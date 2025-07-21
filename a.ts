import * as crypto from 'crypto';

function decryptData(
  encryptedHex: string,
  aesKey: string,
  salt: string,
): string {
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
  const saltBuffer = Buffer.from(salt, 'utf-8');

  // Fixed IV - must match the one used during encryption
  const ivBuffer = Buffer.from([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ]);

  // Derive the same key
  const derivedKey = crypto.pbkdf2Sync(aesKey, saltBuffer, 65536, 32, 'sha1');

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, ivBuffer);

  let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function encryptData(plainText: string, aesKey: string, salt: string): string {
  const saltBuffer = Buffer.from(salt, 'utf-8');

  // Fixed IV - same as in Java and your decrypt function
  const ivBuffer = Buffer.from([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ]);

  // Derive key using PBKDF2 with HMAC-SHA1, 65536 iterations, 256-bit key
  const derivedKey = crypto.pbkdf2Sync(aesKey, saltBuffer, 65536, 32, 'sha1');

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, ivBuffer);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted; // hex string
}

const aesKey = 'YourPassword123!';
const salt = 'randomSalt123';
const original = JSON.stringify({
  amount: '100.00',
  clientId: 'TP_live_TEDbHOHt7kzBrRv6',
  signature: '23fe3ad6d01ccd1822ed42137ff337ceaee039681ca9f4dd9feafd9d56a6a611',
  mobileNumber: '9806026180',
  clientSecret: 'nY3me2z07AheQHSC',
  txnCurr: 'INR',
  emailId: 'RQQQdQAADQ@gmail.com',
  prodId: '20250616101023300140884',
  udf1: '20250616101023300140884',
  username: 'DevKunal',
});

// const encrypted = encryptData(original, aesKey, salt);
// console.log('Encrypted:', encrypted);

// const decrypted = decryptData(encrypted, aesKey, salt);
// console.log('Decrypted:', decrypted);

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
// console.log('----------------');

// console.log(new Date());

// console.log('xyz', dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'));
// console.log(dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'));

// console.log('50' < '2500');

// dayjs.extend(utc);
// dayjs.extend(timezone);

// const now = dayjs().tz('Asia/Kolkata');

// // Get milliseconds
// const milliseconds = now.millisecond(); // already 0–999

// // Format as ISO8601 with custom millisecond logic
// const formatted =
//   now.format('YYYY-MM-DDTHH:mm:ss') +
//   '.' +
//   String(milliseconds).padStart(3, '0') +
//   now.format('Z'); // timezone offset like +05:30

// console.log('Formatted:', formatted);
// console.log(
//   'Formatted:',
//   dayjs().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
// );
// console.log(parseFloat('50').toFixed(1), 8);
// console.log(parseFloat('50.0').toFixed(1), 8);
// console.log(parseFloat('50.88').toFixed(1), 8);

// console.log((67.0).toFixed(1));
// console.log((68.98).toFixed(1));
// console.log((78.09).toFixed(1));
// console.log('----------------------------------');

// console.log((Math.trunc(67.0 * 10) / 10).toFixed(1));
// console.log((Math.trunc(68.98 * 10) / 10).toFixed(1));
// console.log((Math.trunc(78.09 * 10) / 10).toFixed(1));
// console.log('----------------------------------');
// console.log('50');
// console.log(Number(parseFloat('50')));
// console.log(Number('50'));
// const resposeData = {
//   clientId: 'TP_live_gC7KkRBRQCdtssWK',
//   clientSecret: 'ap7Kl5WMOOftanNu',
//   // orderID: 'TPqQbddmN7JjlNw',
// };
// function encryptAES128ECB(data: any, key: string): string {
//   const plaintext = JSON.stringify(data);
//   const cipherKey = Buffer.from(key, 'utf8');

//   const cipher = crypto.createCipheriv('aes-128-ecb', cipherKey, null);
//   cipher.setAutoPadding(true);

//   const encrypted = Buffer.concat([
//     cipher.update(plaintext, 'utf8'),
//     cipher.final(),
//   ]);

//   return encrypted.toString('base64');
// }
// console.log(encryptAES128ECB(JSON.stringify(resposeData), 'ap7Kl5WMOOftanNu'));

dayjs.extend(utc);
dayjs.extend(timezone);

const now = dayjs().tz('Asia/Kolkata');

const milliseconds = now.millisecond(); // Gives 0-999
const formatted = `${now.format('YYYY-MM-DDTHH:mm:ss')}.${milliseconds
  .toString()
  .padStart(3, '0')}${now.format('Z')}`; // 'Z' gives timezone offset like +05:30

console.log(formatted);
console.log(dayjs().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSZ'));
