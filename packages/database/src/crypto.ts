import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is required for API key encryption');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const key = getMasterKey();
  const payload = ciphertext.startsWith('enc:') ? ciphertext.slice(4) : ciphertext;
  const [ivHex, tagHex, encHex] = payload.split(':');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

export function decryptApiKey(storedValue: string | null): string | null {
  if (!storedValue) return null;
  if (storedValue.startsWith('enc:')) {
    return decrypt(storedValue);
  }
  return storedValue;
}

export function isEncrypted(storedValue: string): boolean {
  return storedValue.startsWith('enc:');
}
