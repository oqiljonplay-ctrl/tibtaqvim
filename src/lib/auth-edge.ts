import { jwtVerify } from "jose";

export interface JwtPayload {
  userId: string;
  clinicId: string | null;
  role: string;
}

export async function verifyTokenEdge(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
