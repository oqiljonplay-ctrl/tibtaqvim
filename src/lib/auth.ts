import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

export interface JwtPayload {
  userId: string;
  clinicId: string | null;
  branchId: string | null;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7);
    if (bearer) return bearer;
  }
  const cookie = req.cookies.get("auth_token");
  return cookie?.value ?? null;
}

export function requireAuth(req: NextRequest): JwtPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: "Parol kamida 8 belgi bo'lishi kerak" };
  if (!/[a-zA-Z]/.test(password)) return { valid: false, error: "Parol kamida 1 ta harf bo'lishi kerak" };
  if (!/[0-9]/.test(password)) return { valid: false, error: "Parol kamida 1 ta raqam bo'lishi kerak" };
  return { valid: true };
}

// o, l, 0, 1 yo'q — chalg'itadi
const PWD_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRandomPassword(length = 12): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += PWD_CHARS[Math.floor(Math.random() * PWD_CHARS.length)];
  }
  if (!/[0-9]/.test(result)) result = result.slice(0, -1) + "7";
  return result;
}

/**
 * EM'i bor xodim uchun em_key cookie tekshiruvi.
 * Employee yo'q bo'lsa (admin) — o'tkazadi (true).
 */
export async function requireEmVerified(req: NextRequest, auth: JwtPayload): Promise<boolean> {
  const employee = await prisma.employee.findUnique({
    where: { userId: auth.userId },
    select: { emId: true },
  });
  if (!employee) return true;
  const cookie = req.cookies.get("em_key")?.value;
  return cookie === employee.emId;
}
