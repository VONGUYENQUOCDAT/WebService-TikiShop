import type { User, UserRole } from "@/shared/api/types";

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === "ADMIN";
}

export function isSeller(user: User | null | undefined): boolean {
  return user?.role === "SELLER";
}

export function roleLabel(role: UserRole | undefined): string {
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "SELLER") return "Nhà bán hàng";
  return "Khách hàng";
}
