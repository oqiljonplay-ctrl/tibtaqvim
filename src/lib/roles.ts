export type StaffRole =
  | "super_admin"
  | "clinic_admin"
  | "branch_admin"
  | "doctor"
  | "receptionist";

export interface RoleMeta {
  label: string;
  icon: string;
  badgeClass: string;
  accentColor: string;
}

export const ROLE_META: Record<StaffRole, RoleMeta> = {
  super_admin: {
    label: "Bosh administrator",
    icon: "👑",
    badgeClass: "bg-purple-100 text-purple-700",
    accentColor: "#7c3aed",
  },
  clinic_admin: {
    label: "Klinika administratori",
    icon: "🏥",
    badgeClass: "bg-indigo-100 text-indigo-700",
    accentColor: "#4f46e5",
  },
  branch_admin: {
    label: "Filial administratori",
    icon: "🏢",
    badgeClass: "bg-blue-100 text-blue-700",
    accentColor: "#2563eb",
  },
  doctor: {
    label: "Shifokor",
    icon: "👨‍⚕️",
    badgeClass: "bg-emerald-100 text-emerald-700",
    accentColor: "#059669",
  },
  receptionist: {
    label: "Qabulxona xodimi",
    icon: "📋",
    badgeClass: "bg-amber-100 text-amber-700",
    accentColor: "#d97706",
  },
};

export function getRoleMeta(role: string): RoleMeta {
  return (
    ROLE_META[role as StaffRole] ?? {
      label: role,
      icon: "👤",
      badgeClass: "bg-gray-100 text-gray-700",
      accentColor: "#6b7280",
    }
  );
}
