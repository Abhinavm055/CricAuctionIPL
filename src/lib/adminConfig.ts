import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AdminConfig {
  adminEmail?: string | null;
  updatedAt?: any;
}

export const DEFAULT_ADMIN_EMAIL = 'malayilabhinav16@gmail.com';

/**
 * Normalizes and securely compares the authenticated user email against
 * the configured admin email from Firestore (appConfig/admin) and default admin email.
 */
export const isUserConfigAdmin = (
  userEmail?: string | null,
  configAdminEmail?: string | null
): boolean => {
  if (!userEmail) {
    return false;
  }
  const normalizedUser = userEmail.trim().toLowerCase();
  const normalizedConfig = (configAdminEmail || '').trim().toLowerCase();
  const normalizedDefault = DEFAULT_ADMIN_EMAIL.toLowerCase();

  return Boolean(
    normalizedUser === normalizedDefault ||
    (normalizedConfig && normalizedUser === normalizedConfig)
  );
};

/**
 * Fetches the admin configuration document (appConfig/admin) from Firestore once.
 * Returns null if the document does not exist or if Firestore cannot be reached.
 */
export const getAdminConfig = async (): Promise<AdminConfig | null> => {
  try {
    const configRef = doc(db, 'appConfig', 'admin');
    const snap = await getDoc(configRef);
    if (!snap.exists()) {
      return null;
    }
    return (snap.data() as AdminConfig) || null;
  } catch (error) {
    console.warn('[adminConfig] Failed to fetch admin configuration:', error);
    return null;
  }
};

/**
 * Subscribes to real-time updates for the admin configuration (appConfig/admin).
 * If adminEmail changes in Firestore, the callback is invoked with the new config.
 */
export const listenAdminConfig = (
  onUpdate: (config: AdminConfig | null) => void,
  onError?: (error: any) => void
): (() => void) => {
  try {
    const configRef = doc(db, 'appConfig', 'admin');
    return onSnapshot(
      configRef,
      (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        onUpdate((snap.data() as AdminConfig) || null);
      },
      (error) => {
        console.warn('[adminConfig] Listener encountered an error:', error);
        if (onError) onError(error);
        onUpdate(null);
      }
    );
  } catch (error) {
    console.warn('[adminConfig] Unable to attach admin configuration listener:', error);
    if (onError) onError(error);
    onUpdate(null);
    return () => {};
  }
};
