'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut, Auth, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, onValue, off, get, set } from 'firebase/database';
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
                setUserPermissions(null);
            }
            setLoading(false);
        });

        if (pathname === '/login') {
            router.replace('/');
        }
      } else {
        setUserPermissions(null);
        setLoading(false);
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

 const login = async (email: string, pass: string) => {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      // No users in DB, this is the first user, create them as admin.
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const firstUser = userCredential.user;
        const adminPermissions: UserPermissions = {
            role: 'admin',
            permissions: {
                inicio: true,
                disputa: true,
                sorteio: true,
                ganhadores: true,
            },
        };
        await set(ref(database, `users/${firstUser.uid}`), {
            email: firstUser.email,
            ...adminPermissions
        });
        return userCredential;
      } catch(error) {
        // If account already exists in Auth but not in DB, try to sign in
        return signInWithEmailAndPassword(auth, email, pass);
      }
    } else {
      // Users exist, proceed with normal login
      return signInWithEmailAndPassword(auth, email, pass);
    }
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
