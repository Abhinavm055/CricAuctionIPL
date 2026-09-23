import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { isUserConfigAdmin, listenAdminConfig, DEFAULT_ADMIN_EMAIL, type AdminConfig } from '@/lib/adminConfig';

interface AdminContextType {
  user: User | null;
  adminEmail: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AdminContext = createContext<AdminContextType>({
  user: null,
  adminEmail: null,
  isAdmin: false,
  isAuthenticated: false,
  isLoading: true,
});

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [configLoading, setConfigLoading] = useState<boolean>(true);

  // 1. Listen to Firebase Authentication state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // 2. Listen to Firestore appConfig/admin in real time
  useEffect(() => {
    const unsubConfig = listenAdminConfig(
      (config) => {
        setAdminConfig(config);
        setConfigLoading(false);
      },
      (error) => {
        console.warn('[AdminContext] Could not load appConfig/admin:', error);
        setAdminConfig(null);
        setConfigLoading(false);
      }
    );
    return () => unsubConfig();
  }, []);

  const adminEmail = adminConfig?.adminEmail || DEFAULT_ADMIN_EMAIL;
  const isAdmin = isUserConfigAdmin(user?.email, adminEmail);
  const isLoading = authLoading || (configLoading && !isAdmin && Boolean(user));

  return (
    <AdminContext.Provider
      value={{
        user,
        adminEmail,
        isAdmin,
        isAuthenticated: isAdmin,
        isLoading,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};


