// RSA key pair generation and digital signature utilities using Web Crypto API

export async function generateRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['sign', 'verify']
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
  const privateKey = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));

  return { publicKey, privateKey };
}

export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

export async function signData(privateKeyBase64: string, data: string): Promise<string> {
  const privateKeyBuffer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  
  const privateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const signatureBuffer = await window.crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, dataBuffer);

  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

export async function verifySignature(publicKeyBase64: string, signature: string, data: string): Promise<boolean> {
  try {
    const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
    const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    return await window.crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signatureBuffer, dataBuffer);
  } catch {
    return false;
  }
}

// AES-GCM encryption of private key using a password
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(privateKeyBase64: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveKeyFromPassword(password, salt);
  const encoder = new TextEncoder();
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(privateKeyBase64)
  );
  // Format: salt(16) + iv(12) + ciphertext → base64
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptPrivateKey(encryptedBase64: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const aesKey = await deriveKeyFromPassword(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// Fetch encrypted private key from server and decrypt with password
export async function getServerPrivateKey(userId: string, password: string): Promise<string | null> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data } = await supabase
    .from('digital_signatures')
    .select('encrypted_private_key')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!data?.encrypted_private_key) return null;
  
  try {
    return await decryptPrivateKey(data.encrypted_private_key, password);
  } catch {
    return null;
  }
}

// Clear any legacy plaintext private key copies that older versions stored.
// Plaintext private keys MUST NEVER be persisted to localStorage.
export function purgeLegacyPrivateKeys(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('private_key_')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

