import { VaultState, EncryptedVaultPayload } from '../types';

// Convert array buffer to hex string
function bufToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.length; i++) {
    const hex = byteArray[i].toString(16);
    hexString += (hex.length === 1 ? '0' : '') + hex;
  }
  return hexString;
}

// Convert hex string to Uint8Array
function hexToBuf(hexString: string): Uint8Array {
  // If length is odd, pad
  const cleanHex = hexString.length % 2 === 0 ? hexString : '0' + hexString;
  const numBytes = cleanHex.length / 2;
  const byteArray = new Uint8Array(numBytes);
  for (let i = 0; i < numBytes; i++) {
    byteArray[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return byteArray;
}

// Derive AES-GCM Key from Master Password
async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);

  // Import raw password as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive the 256-bit AES key
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts the local vault state using the master password
 */
export async function encryptVault(state: VaultState, password: string): Promise<EncryptedVaultPayload> {
  const iterations = 100000;
  
  // 1. Generate random salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Derive key
  const aesKey = await deriveKey(password, salt, iterations);

  // 3. Serialize our vault state to JSON
  const enc = new TextEncoder();
  const serializedState = enc.encode(JSON.stringify(state));

  // 4. Encrypt with AES-GCM
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    serializedState
  );

  // 5. Package as payload
  return {
    salt: bufToHex(salt.buffer),
    iv: bufToHex(iv.buffer),
    ciphertext: bufToHex(ciphertextBuffer),
    iterations
  };
}

/**
 * Decrypts an encrypted vault payload using the master password
 */
export async function decryptVault(payload: EncryptedVaultPayload, password: string): Promise<VaultState> {
  const salt = hexToBuf(payload.salt);
  const iv = hexToBuf(payload.iv);
  const ciphertext = hexToBuf(payload.ciphertext);

  // 1. Derive key
  const aesKey = await deriveKey(password, salt, payload.iterations);

  try {
    // 2. Decrypt ciphertext
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      ciphertext
    );

    // 3. Decode into JSON
    const dec = new TextDecoder();
    const str = dec.decode(decryptedBuffer);
    return JSON.parse(str) as VaultState;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('رمز عبور مستر اشتباه است یا فایل رمزگذاری شده تخریب شده است.');
  }
}

/**
 * Create a dummy encryption to verify if password is valid
 * Storing a verification hash directly is insecure as it allows offline brute force,
 * but verifying if decryption of a tiny known format succeeds is a standard approach.
 */
export async function checkMasterPassword(password: string, payload: EncryptedVaultPayload): Promise<boolean> {
  try {
    await decryptVault(payload, password);
    return true;
  } catch (e) {
    return false;
  }
}
