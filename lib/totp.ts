// EduManage — RFC 6238 TOTP implementation using Web Crypto (HMAC-SHA1)
//
// Compatible with Google Authenticator, Microsoft Authenticator, 1Password,
// Authy, and any other RFC 6238 compliant authenticator.
//
// The Web Crypto API (`crypto.subtle.importKey` + `sign`) is available in
// React Native via `expo-crypto` (which polyfills `globalThis.crypto.subtle`)
// and in all modern browsers. We lazily detect it and throw a clear error
// when unavailable.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode a Base32 (RFC 4648) string into a `Uint8Array` of raw bytes. */
export function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error(`base32Decode: invalid character '${char}'`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(output);
}

/** Encode a `Uint8Array` into a Base32 (RFC 4648) string without padding. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

/**
 * Generate a cryptographically random 32-character Base32 TOTP secret.
 * 32 base32 chars = 160 bits of entropy (the recommended size per RFC 6238 §4 R).
 */
export function generateTOTPSecret(length = 32): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('generateTOTPSecret: Web Crypto getRandomValues unavailable');
  }
  // 20 random bytes → 32 base32 chars (ceil(20 * 8 / 5) = 32)
  const byteLength = Math.ceil((length * 5) / 8);
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  const encoded = base32Encode(bytes);
  return encoded.slice(0, length);
}

async function importHmacKey(secretBytes: Uint8Array): Promise<CryptoKey> {
  if (!crypto?.subtle) {
    throw new Error('TOTP: Web Crypto subtle crypto unavailable');
  }
  return crypto.subtle.importKey(
    'raw',
    secretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
}

function intToBytes(num: number): Uint8Array {
  // 64-bit big-endian counter. JS numbers lose precision above 2^53, so we
  // split the high/low 32 bits to be safe (counters are well under 2^32 in
  // practice — a 30s step would take ~4,000 years to overflow 32 bits).
  const buf = new Uint8Array(8);
  const high = Math.floor(num / 0x100000000);
  const low = num >>> 0;
  buf[0] = (high >>> 24) & 0xff;
  buf[1] = (high >>> 16) & 0xff;
  buf[2] = (high >>> 8) & 0xff;
  buf[3] = high & 0xff;
  buf[4] = (low >>> 24) & 0xff;
  buf[5] = (low >>> 16) & 0xff;
  buf[6] = (low >>> 8) & 0xff;
  buf[7] = low & 0xff;
  return buf;
}

/** Default TOTP period (30s) and digits (6) per RFC 6238. */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

/**
 * Generate a TOTP code for the given secret at the current time (or at the
 * provided counter / time step).
 *
 * @param secret  Base32-encoded secret
 * @param counter Optional time-step counter (defaults to `now / 30s`)
 */
export async function generateTOTP(
  secret: string,
  counter?: number,
): Promise<string> {
  if (counter === undefined) {
    counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  }
  const keyBytes = base32Decode(secret);
  const key = await importHmacKey(keyBytes);
  const msg = intToBytes(counter);
  const hmacBuf = await crypto.subtle.sign('HMAC', key, msg as BufferSource);
  const hmac = new Uint8Array(hmacBuf);

  // Dynamic truncation per RFC 4226 §5.3
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = binary % 10 ** TOTP_DIGITS;
  return code.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Constant-time string comparison. Prevents timing attacks where an attacker
 * could measure response time to brute-force a single digit at a time.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify a user-supplied TOTP token against the secret. Accepts tokens from
 * the current step, plus or minus `windowSteps` steps (default 1 = ±30s).
 *
 * @returns `true` if the token matched any step within the window.
 */
export async function verifyTOTP(
  secret: string,
  token: string,
  windowSteps = 1,
): Promise<boolean> {
  if (!token || token.length !== TOTP_DIGITS) return false;
  const now = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let i = -windowSteps; i <= windowSteps; i++) {
    const expected = await generateTOTP(secret, now + i);
    if (constantTimeEqual(token, expected)) return true;
  }
  return false;
}

/**
 * Build an `otpauth://` provisioning URI per Google Authenticator's de-facto
 * standard. Returns the URI string suitable for rendering as a QR code.
 *
 * @example
 *   buildOTPAuthURI({ issuer: 'EduManage', account: 'jane@school.edu', secret: 'JBSWY3DP...' })
 *   // → "otpauth://totp/EduManage:jane%40school.edu?secret=...&issuer=EduManage&algorithm=SHA1&digits=6&period=30"
 */
export function buildOTPAuthURI(opts: {
  issuer: string;
  account: string;
  secret: string;
  period?: number;
  digits?: number;
}): string {
  const { issuer, account, secret } = opts;
  const period = opts.period ?? TOTP_PERIOD_SECONDS;
  const digits = opts.digits ?? TOTP_DIGITS;
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
