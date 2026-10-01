import { UserRole } from '../types/index.js';

const ALL_ROLES = Object.values(UserRole);

export function grantedRoles(user: { role: UserRole; roles?: UserRole[] | null }): UserRole[] {
  return Array.from(new Set<UserRole>([user.role, ...(user.roles ?? [])]));
}

export function parseRoles(value: unknown): UserRole[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const roles: UserRole[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !ALL_ROLES.includes(item as UserRole)) return null;
    if (!roles.includes(item as UserRole)) roles.push(item as UserRole);
  }
  return roles;
}
