import { prisma } from "./prisma";

// o, l, 0, 1 yo'q — chalg'itadi
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

async function generateUsername(prefix: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = "";
    for (let i = 0; i < 7; i++) {
      suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const username = `${prefix}_${suffix}`;
    const exists = await prisma.user.findUnique({ where: { username } });
    if (!exists) return username;
  }
  throw new Error("Username generatsiya qilishda muammo (10 urinishda topilmadi)");
}

export function generateAdminUsername(): Promise<string> {
  return generateUsername("tib_admin");
}

export function generateBranchAdminUsername(): Promise<string> {
  return generateUsername("tib_badmin");
}

export function isValidUsername(username: string): boolean {
  return /^tib_b?admin_[a-z0-9]{6,8}$/.test(username);
}
