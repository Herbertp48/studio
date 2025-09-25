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
                // This can happen if a user exists in Auth but not in DB
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 const login = async (email: string, pass: string) => {
    try {
      // The most common path is a normal login. We try this first.
      return await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      // If the user is not found, it might be the very first user trying to register.
      if (error.code === 'auth/user-not-found') {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);

        // If the 'users' table in the database is empty, create this first user as admin.
        if (!snapshot.exists()) {
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
          // Save the admin user's permissions to the database.
          await set(ref(database, `users/${firstUser.uid}`), {
            email: firstUser.email,
            ...adminPermissions
          });
          return userCredential;
        }
      }
      // If the error is not 'auth/user-not-found' or if the DB is not empty,
      // we re-throw the original error to be caught by the login page UI.
      throw error;
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
