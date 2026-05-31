import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export class SecretStore {
  constructor(file, passphrase) {
    this.file = file;
    this.passphrase = passphrase;
  }

  async set(name, value) {
    this.assertReady();
    const secrets = await this.all();
    secrets[name] = value;
    await this.write(secrets);
  }

  async get(name) {
    this.assertReady();
    const secrets = await this.all();
    return secrets[name] || null;
  }

  async all() {
    this.assertReady();
    try {
      const envelope = JSON.parse(await readFile(this.file, "utf8"));
      const key = scryptSync(this.passphrase, Buffer.from(envelope.salt, "hex"), 32);
      const decipher = createDecipheriv("chacha20-poly1305", key, Buffer.from(envelope.nonce, "hex"), {
        authTagLength: 16
      });
      decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "hex")),
        decipher.final()
      ]);
      return JSON.parse(plaintext.toString("utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  async write(secrets) {
    const salt = randomBytes(16);
    const nonce = randomBytes(12);
    const key = scryptSync(this.passphrase, salt, 32);
    const cipher = createCipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secrets)), cipher.final()]);
    const envelope = {
      version: 1,
      algorithm: "chacha20-poly1305",
      salt: salt.toString("hex"),
      nonce: nonce.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      ciphertext: ciphertext.toString("hex")
    };
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  }

  assertReady() {
    if (!this.passphrase) {
      throw new Error("SECRET_STORE_PASSPHRASE precisa estar configurada para usar segredos.");
    }
  }
}
