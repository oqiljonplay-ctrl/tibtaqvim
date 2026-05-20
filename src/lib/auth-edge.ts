import { jwtVerify } from "jose";

/**
 * Edge runtime uchun JWT payload.
 * Bu interfeys `src/lib/auth.ts` ichidagi JwtPayload bilan sinxron bo'lishi shart.
 * branchId — branch_admin rolida ishlatiladi (Faza 3).
 */
export interface JwtPayload {
  userId: string;
  clinicId: string | null;
  branchId: string | null;
  role: string;
}

export async function verifyTokenEdge(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    // jose JWTPayload type'i Record<string, unknown> dan keladi, kerakli field'lar bo'lmasligi mumkin
    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      clinicId: typeof payload.clinicId === "string" ? payload.clinicId : null,
      branchId: typeof payload.branchId === "string" ? payload.branchId : null,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
