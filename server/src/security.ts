import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algorithm, saltHex, hashHex] = stored.split("$");
    if (algorithm !== "scrypt" || !saltHex || !hashHex || !/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false;
    const derived = await scrypt(password, Buffer.from(saltHex, "hex"), 64) as Buffer;
    const expected = Buffer.from(hashHex, "hex");
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch { return false; }
}

export function safeUser(user: { id: string; displayName: string; role: string }) {
  return { id: user.id, displayName: user.displayName, role: user.role };
}
