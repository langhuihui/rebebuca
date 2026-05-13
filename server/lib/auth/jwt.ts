import { SignJWT, jwtVerify } from 'jose';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const JWT_ALGORITHM = 'HS256';
const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

async function getJwtSecret(): Promise<Uint8Array> {
  const ctx = await getCloudflareContext({ async: true });
  const secret = ctx.env.JWT_SECRET || 'default-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  sub: string; // user id
  email: string;
  type: 'access' | 'refresh';
}

export async function createAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email, type: 'access' })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(await getJwtSecret());
}

export async function createRefreshToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email, type: 'refresh' })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(await getJwtSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, await getJwtSecret());
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry;
}
