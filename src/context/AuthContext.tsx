'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut, Auth } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { useRouter, usePathname } from 'next/navigation';

export interface UserPermissions {
    role: 'admin' | 'user';
    permissions: {
        inicio: boolean;
        disputa: boolean;
        sorteio: boolean;
        ganhadores: boolean;
    }
}

interface AuthContextType {
  user: User | null;
  userPermissions: UserPermissions | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        const userPermsRef = ref(database, `users/${user.uid}`);
        onValue(userPermsRef, (snapshot) => {
            const perms = snapshot.val();
            if (perms) {
                setUserPermissions(perms);
            } else {
                // If user exists in Auth but not in DB (e.g. deleted from users page), treat as logged out
                setUserPermissions(null);
            }
            setLoading(false);
        });

        // Redirect from login page if already logged in
        if (pathname === '/login') {
            router.replace('/');
        }
      } else {
        setUserPermissions(null);
        setLoading(false);
        // Redirect to login if not on the login page
        if (pathname !== '/login') {
            router.replace('/login');
        }
      }
    });

    return () => {
        unsubscribe();
        if(user) {
            off(ref(database, `users/${user.uid}`));
        }
    };
  }, [router, pathname, user]);

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    user,
    userPermissions,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
