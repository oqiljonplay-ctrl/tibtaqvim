import { prisma } from "./prisma";

// o, l, 0, 1 yo'q — chalg'itadi
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export async function generateAdminUsername(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = "";
    for (let i = 0; i < 7; i++) {
      suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const username = `tib_admin_${suffix}`;
    const exists = await prisma.user.findUnique({ where: { username } });
    if (!exists) return username;
  }
  throw new Error("Username generatsiya qilishda muammo (10 urinishda topilmadi)");
}

export function isValidUsername(username: string): boolean {
  return /^tib_admin_[a-z0-9]{6,8}$/.test(username);
}
