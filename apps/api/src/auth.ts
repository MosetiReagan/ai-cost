import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [hash, salt] = storedHash.split('.');
    if (!hash || !salt) return false;
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    const keyBuffer = Buffer.from(hash, 'hex');
    return timingSafeEqual(buf, keyBuffer);
  } catch {
    return false;
  }
}

export function generateApiKey(): { rawKey: string; keyPrefix: string; hashedKey: string } {
  const random = randomBytes(24).toString('hex');
  const rawKey = `ac_live_${random}`;
  const keyPrefix = `ac_live_${random.slice(0, 4)}...`;
  const hashedKey = createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, keyPrefix, hashedKey };
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey.trim()).digest('hex');
}

