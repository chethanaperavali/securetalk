// AES-GCM encryption utilities for end-to-end encrypted messaging

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

// Generate a random encryption key
export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Export key to base64 string for storage
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import key from base64 string
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a message
export async function encryptMessage(
  message: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  // Generate a random initialization vector
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

// Decrypt a message
export async function decryptMessage(
  encryptedContent: string,
  ivString: string,
  key: CryptoKey
): Promise<string> {
  const encryptedData = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    encryptedData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Store encryption key in localStorage (for demo purposes)
// In production, use a more secure key exchange mechanism
export function storeConversationKey(conversationId: string, keyString: string): void {
  const keys = JSON.parse(localStorage.getItem('echo_secure_keys') || '{}');
  keys[conversationId] = keyString;
  localStorage.setItem('echo_secure_keys', JSON.stringify(keys));
}

export function getConversationKey(conversationId: string): string | null {
  const keys = JSON.parse(localStorage.getItem('echo_secure_keys') || '{}');
  return keys[conversationId] || null;
}

export function removeConversationKey(conversationId: string): void {
  const keys = JSON.parse(localStorage.getItem('echo_secure_keys') || '{}');
  delete keys[conversationId];
  localStorage.setItem('echo_secure_keys', JSON.stringify(keys));
}
