import { NextRequest, NextResponse } from 'next/server';
import { signSession, verifySession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const logs: string[] = [];
  logs.push('--- Pramaan Service Integration Self-Test ---');

  // Test 1: Crypto Session Signing & Expiration Verification
  logs.push('Testing Web Crypto stateless session tokens...');
  const secret = 'test-secret-passcode-123';
  const payload = { role: 'technohands' as const, timestamp: Date.now() };

  try {
    const token = await signSession(payload, secret);
    logs.push(`✓ Token signed: ${token.substring(0, 15)}...`);

    const verified = await verifySession(token, secret);
    logs.push(`✓ Token verified: ${JSON.stringify(verified)}`);

    if (verified && verified.role === payload.role) {
      logs.push('✓ Payload integrity validated!');
    } else {
      throw new Error('Payload values did not match!');
    }

    // Test incorrect passcode verification
    const invalidVerify = await verifySession(token, 'wrong-secret');
    if (invalidVerify === null) {
      logs.push('✓ Signature mismatch correctly rejected!');
    } else {
      throw new Error('Failed to reject signature mismatch!');
    }

    // Test expired session TTL check
    const expiredPayload = { role: 'technohands' as const, timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000 }; // 8 days ago
    const expiredToken = await signSession(expiredPayload, secret);
    const expiredVerify = await verifySession(expiredToken, secret);
    if (expiredVerify === null) {
      logs.push('✓ Expired token (7+ days) correctly rejected!');
    } else {
      throw new Error('Failed to reject expired token!');
    }

  } catch (err: any) {
    logs.push(`✗ Session test failed: ${err.message}`);
  }

  // Test 2: Environment Variables Presence
  logs.push('Testing required environment variables...');
  const requiredEnv = [
    'TECHNOHANDS_PASSCODE',
    'NEURATANTRAAI_PASSCODE',
    'GEMINI_API_KEY',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    'GOOGLE_SHEET_ID'
  ];

  let missing = 0;
  requiredEnv.forEach(env => {
    if (!process.env[env]) {
      logs.push(`- ${env}: MISSING`);
      missing++;
    } else {
      logs.push(`- ${env}: PRESENT (length: ${process.env[env]?.length})`);
    }
  });

  if (missing === 0) {
    logs.push('✓ All environment variables are configured.');
  } else {
    logs.push(`! Warning: ${missing} env var(s) missing.`);
  }

  return NextResponse.json({ success: missing === 0, logs });
}
