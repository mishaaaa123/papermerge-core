/**
 * File encryption utilities for password-protected documents in browser cache.
 * 
 * Uses Web Crypto API with AES-GCM encryption, similar to backend Fernet encryption.
 * Implements PBKDF2 key derivation for password-based encryption.
 */

/**
 * Derive an encryption key from a password using PBKDF2.
 * 
 * @param password - The password string
 * @param salt - Random salt bytes
 * @returns A CryptoKey suitable for AES-GCM encryption
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )

  // Derive key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // Same as backend
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )

  return key
}

/**
 * Generate a random salt for encryption.
 * 
 * @returns 16-byte random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Encrypt file content using a password.
 * 
 * @param content - The file content as ArrayBuffer
 * @param password - The password to use for encryption
 * @returns Object containing encrypted content, salt, and IV
 */
export async function encryptFileContent(
  content: ArrayBuffer,
  password: string
): Promise<{
  encryptedContent: ArrayBuffer
  salt: Uint8Array
  iv: Uint8Array
}> {
  // Generate random salt and IV
  const salt = generateSalt()
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for GCM

  // Derive key from password
  const key = await deriveKeyFromPassword(password, salt)

  // Encrypt the content
  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    content
  )

  return {
    encryptedContent,
    salt,
    iv
  }
}

/**
 * Decrypt file content using a password, salt, and IV.
 * 
 * @param encryptedContent - The encrypted file content
 * @param password - The password used for encryption
 * @param salt - The salt used during encryption
 * @param iv - The initialization vector used during encryption
 * @returns Decrypted file content as ArrayBuffer
 * @throws Error if password is incorrect or decryption fails
 */
export async function decryptFileContent(
  encryptedContent: ArrayBuffer,
  password: string,
  salt: Uint8Array,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  try {
    // Derive key from password using the same salt
    const key = await deriveKeyFromPassword(password, salt)

    // Decrypt the content
    const decryptedContent = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      encryptedContent
    )

    return decryptedContent
  } catch (error) {
    throw new Error("Incorrect password or corrupted encrypted data")
  }
}

/**
 * Convert Uint8Array to base64 string for storage.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Encrypt and serialize file content for storage.
 * Returns a base64-encoded string containing encrypted data, salt, and IV.
 * 
 * Format: base64(encryptedContent) + "|" + base64(salt) + "|" + base64(iv)
 */
export async function encryptAndSerialize(
  content: ArrayBuffer,
  password: string
): Promise<string> {
  const { encryptedContent, salt, iv } = await encryptFileContent(content, password)

  // Convert ArrayBuffers to base64 strings
  const encryptedBase64 = uint8ArrayToBase64(new Uint8Array(encryptedContent))
  const saltBase64 = uint8ArrayToBase64(salt)
  const ivBase64 = uint8ArrayToBase64(iv)

  // Combine with separator
  return `${encryptedBase64}|${saltBase64}|${ivBase64}`
}

/**
 * Deserialize and decrypt file content from storage.
 * 
 * @param encryptedData - Base64-encoded string from encryptAndSerialize
 * @param password - The password used for encryption
 * @returns Decrypted file content as ArrayBuffer
 */
export async function deserializeAndDecrypt(
  encryptedData: string,
  password: string
): Promise<ArrayBuffer> {
  const parts = encryptedData.split("|")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format")
  }

  const [encryptedBase64, saltBase64, ivBase64] = parts

  // Convert base64 strings to ArrayBuffers
  const encryptedContent = base64ToUint8Array(encryptedBase64).buffer
  const salt = base64ToUint8Array(saltBase64)
  const iv = base64ToUint8Array(ivBase64)

  // Decrypt
  return decryptFileContent(encryptedContent, password, salt, iv)
}

