/**
 * Client-side RFC 6238 TOTP implementation using browser SubtleCrypto
 */

// Decodes a base32 string into a Uint8Array
export function base32ToBytes(str: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanStr = str.replace(/=+$/, '').replace(/[\s-]+/g, '').toUpperCase();
  
  if (!cleanStr) return new Uint8Array(0);

  const len = cleanStr.length;
  const bytes = new Uint8Array(Math.floor((len * 5) / 8));
  let bits = 0;
  let value = 0;
  let idx = 0;

  for (let i = 0; i < len; i++) {
    const val = alphabet.indexOf(cleanStr[i]);
    if (val === -1) {
      throw new Error(`کاراکتر بیس۳۲ نامعتبر: ${cleanStr[i]}`);
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes[idx++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return bytes;
}

/**
 * Generates a custom 6-digit TOTP token using SubtleCrypto HMAC-SHA-1
 */
export async function generateTOTP(secretBase32: string): Promise<{ token: string; secondsRemaining: number }> {
  try {
    const cleanSecret = secretBase32.trim();
    if (!cleanSecret) {
      return { token: '', secondsRemaining: 30 };
    }

    const secretBytes = base32ToBytes(cleanSecret);
    const epoch = Date.now();
    const timeStep = 30000; // 30 seconds
    const counter = Math.floor(epoch / timeStep);
    const secondsRemaining = 30 - Math.floor((epoch % timeStep) / 1000);

    // Create 8-byte big-endian counter buffer
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, 0); // High-order 32 bits (generally zero for Unix timestamps today)
    view.setUint32(4, counter); // Low-order 32 bits

    // Import HMAC raw key
    const cryptokey = await window.crypto.subtle.importKey(
      'raw',
      secretBytes,
      {
        name: 'HMAC',
        hash: 'SHA-1'
      },
      false,
      ['sign']
    );

    // Computes signature
    const signature = await window.crypto.subtle.sign('HMAC', cryptokey, buffer);
    const hmac = new Uint8Array(signature);

    // Dynamic truncation (RFC 4226)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    const token = String(otp).padStart(6, '0');

    return { token, secondsRemaining };
  } catch (error) {
    console.error('TOTP Generation error:', error);
    return { token: 'Error', secondsRemaining: 30 };
  }
}
