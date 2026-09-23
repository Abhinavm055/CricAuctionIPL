import { User } from 'firebase/auth';
import { isUserConfigAdmin, getAdminConfig, listenAdminConfig, type AdminConfig } from './adminConfig';

export type { AdminConfig };
export { getAdminConfig, listenAdminConfig, isUserConfigAdmin };

/**
 * Checks whether the given user matches the configured administrator email.
 * Both values are normalized using trim().toLowerCase().
 * Returns false if user, user.email, or adminEmail is missing.
 */
export const isUserAdmin = (
  user: User | { email?: string | null } | null | undefined,
  adminEmail?: string | null
): boolean => {
  return isUserConfigAdmin(user?.email, adminEmail);
};

