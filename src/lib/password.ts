import { randomBytes, scrypt } from "node:crypto";

const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 16,
  p: 1,
  keyLength: 64,
} as const;

function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      SCRYPT_OPTIONS.keyLength,
      {
        N: SCRYPT_OPTIONS.N,
        r: SCRYPT_OPTIONS.r,
        p: SCRYPT_OPTIONS.p,
        maxmem: 128 * SCRYPT_OPTIONS.N * SCRYPT_OPTIONS.r * 2,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt);

  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}) {
  const [salt, key] = hash.split(":");

  if (!salt || !key) {
    throw new Error("Invalid password hash");
  }

  const targetKey = await scryptAsync(password, salt);
  return targetKey.toString("hex") === key;
}

export const hashedPassword = {
  hash: hashPassword,
  verify: verifyPassword,
};

export const hasedPassword = hashedPassword;
