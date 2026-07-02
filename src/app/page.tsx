import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
      // --- T4 fix (YANGI): EM'i bor xodim em_key'siz bo'lsa, ROLE_HOME'ga
      //     redirect qilmaymiz (loop) — LoginForm'ni to'g'ridan-to'g'ri EM
      //     bosqichida ko'rsatamiz. Employee bo'lmasa (admin) — o'zgarishsiz.
      const employee = await prisma.employee.findUnique({
        where: { userId: payload.userId },
        select: { emId: true, firstName: true },
      });
      if (employee) {
        const emKey = cookieStore.get("em_key")?.value;
        if (emKey !== employee.emId) {
          return (
            <LoginForm
              initialStep="em"
              emPendingUser={{
                id: payload.userId,
                role: payload.role,
                clinicId: payload.clinicId,
                branchId: payload.branchId,
                firstName: employee.firstName ?? "",
              }}
            />
          );
        }
      }
      // --- T4 fix bloki tugadi; quyidagi mavjud xatti-harakat aynan avvalgidek ---
      redirect(ROLE_HOME[payload.role]);
    }
  }
  return <LoginForm />;
}
