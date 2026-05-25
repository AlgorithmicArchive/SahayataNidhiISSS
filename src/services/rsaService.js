import forge from "node-forge";

class RsaService {
  constructor() {
    this.publicKey = null;
  }

  async fetchPublicKey() {
    const API_BASE = window.__CONFIG__?.API_URL || "";
    const res = await fetch(`${API_BASE}/Home/GetPublicKey`);

    if (!res.ok) {
      throw new Error(`Failed to fetch public key: ${res.status}`);
    }

    const data = await res.json();
    const pem = this.spkiToPem(data.publicKey);
    this.publicKey = forge.pki.publicKeyFromPem(pem);
  }

  spkiToPem(base64Spki) {
    const formatted = base64Spki.match(/.{1,64}/g).join("\n");
    return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
  }

  async encrypt(plaintext) {
    if (!this.publicKey) {
      await this.fetchPublicKey();
    }

    // Verify key is 2048-bit
    if (this.publicKey.n.bitLength() !== 2048) {
      console.error(
        "WARNING: Key is not 2048-bit!",
        this.publicKey.n.bitLength(),
      );
    }

    const encrypted = this.publicKey.encrypt(plaintext, "RSAES-PKCS1-V1_5");
    return forge.util.encode64(encrypted);
  }
}

export const rsaService = new RsaService();
