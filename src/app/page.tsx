import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import LoginForm from "@/components/auth/LoginForm";

const ROLE_HOME: Record<string, string> = {
  super_admin: "/superadminjon",
  clinic_admin: "/admin",
  branch_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

export default async function RootPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload?.role && ROLE_HOME[payload.role]) {
      redirect(ROLE_HOME[payload.role]);
    }
  }
  return <LoginForm />;
}
