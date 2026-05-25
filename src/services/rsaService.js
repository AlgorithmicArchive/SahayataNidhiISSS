// src/services/rsaService.js

class RsaService {
  constructor() {
    this.publicKey = null;
  }

  async fetchPublicKey() {
    const res = await fetch("/swdjk/Home/GetPublicKey");
    const { publicKey } = await res.json();
    this.publicKey = await this.importPublicKey(publicKey);
    return publicKey;
  }

  async importPublicKey(base64Spki) {
    const binaryDer = Uint8Array.from(atob(base64Spki), (c) => c.charCodeAt(0));

    return await window.crypto.subtle.importKey(
      "spki",
      binaryDer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
  }

  async encrypt(plaintext) {
    if (!this.publicKey) {
      await this.fetchPublicKey();
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const encrypted = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      this.publicKey,
      data,
    );

    // SAFE base64 encoding using array buffer
    return this.arrayBufferToBase64(encrypted);
  }

  // Safe base64 conversion without String.fromCharCode issues
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const rsaService = new RsaService();
