import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export const useUserId = () => {
  const [userId, setUserId] = useState<string>(() => {
    const current = auth.currentUser?.uid;
    if (current) {
      localStorage.setItem('uid', current);
      return current;
    }
    const local = localStorage.getItem('uid');
    if (local) return local;
    const fallback = `user-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('uid', fallback);
    return fallback;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        localStorage.setItem('uid', user.uid);
        setUserId(user.uid);
      } else {
        let local = localStorage.getItem('uid');
        if (!local || !local.startsWith('user-')) {
          local = `user-${Math.random().toString(36).slice(2, 9)}`;
          localStorage.setItem('uid', local);
        }
        setUserId(local);
      }
    });
    return () => unsubscribe();
  }, []);

  return userId;
};
