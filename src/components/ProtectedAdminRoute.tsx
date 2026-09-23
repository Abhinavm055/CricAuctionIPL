import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route protection wrapper that strictly enforces Firebase authenticated admin access
 * based on the authorized administrator email (malayilabhinav16@gmail.com) and Firestore config.
 *
 * Rules:
 * 1. Waits for Firebase Auth and configuration to initialize (authLoading / isLoading).
 * 2. If user is unauthenticated -> redirects to "/login".
 * 3. If user is authenticated but not the authorized admin -> redirects to "/".
 * 4. Only renders the admin panel when authenticated as the authorized admin.
 */
export const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { user, isAdmin, isLoading } = useAdmin();

  // Wait for both Auth and Firestore config to resolve before deciding
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center text-primary font-display text-2xl gap-3">
        <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        <span className="animate-pulse tracking-widest text-sm text-yellow-400/80 uppercase">Verifying Authorization...</span>
      </div>
    );
  }

  // 1. If user is not authenticated -> redirect to /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. If user is authenticated but is NOT the authorized admin -> redirect to /
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // 3. Authorized admin -> allow access
  return <>{children}</>;
};

export default ProtectedAdminRoute;
