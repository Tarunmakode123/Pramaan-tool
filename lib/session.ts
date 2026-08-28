const ENCODER = new TextEncoder();

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const keyData = ENCODER.encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface SessionPayload {
  role: 'technohands' | 'neuratantraai';
  timestamp: number;
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const dataStr = JSON.stringify(payload);
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, ENCODER.encode(dataStr));
  const sigBase64 = Buffer.from(signature).toString('base64url');
  const dataBase64 = Buffer.from(dataStr).toString('base64url');
  return `${dataBase64}.${sigBase64}`;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataBase64, sigBase64] = parts;
  try {
    const dataStr = Buffer.from(dataBase64, 'base64url').toString('utf8');
    const sigBytes = new Uint8Array(Buffer.from(sigBase64, 'base64url'));

    const key = await getHmacKey(secret);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, ENCODER.encode(dataStr));
    if (!isValid) return null;

    const payload = JSON.parse(dataStr) as SessionPayload;
    
    // Enforce 7 days expiration TTL (7 * 24 * 60 * 60 * 1000 ms)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.timestamp > sevenDaysMs) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}
