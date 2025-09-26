'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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

const initialPermissions = {
  inicio: true,
  disputa: false,
  sorteio: false,
  ganhadores: false,
};

interface AuthContextType {
  user: User | null;
  userPermissions: UserPermissions | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string, name: string) => Promise<any>;
  logout: () => Promise<any>;
  sendPasswordReset: (email: string) => Promise<any>;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, name: string) => {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    const isFirstUser = !snapshot.exists();

    // The user will be created via Auth first
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

    let permissions: UserPermissions;

    if (isFirstUser) {
        // First user is always an admin
        permissions = {
            role: 'admin',
            permissions: { inicio: true, disputa: true, sorteio: true, ganhadores: true },
        };
    } else {
        // Subsequent users are standard users with default permissions
        permissions = {
            role: 'user',
            permissions: initialPermissions,
        };
    }

    // Save user info and permissions to the database
    await set(ref(database, `users/${newUser.uid}`), {
        email: newUser.email,
        name: name,
        ...permissions
    });
    
    // After creating the user, sign them out so they have to log in.
    await signOut(auth);

    return userCredential;
  }

  const sendPasswordReset = (email: string) => {
    return sendPasswordResetEmail(auth, email);
  }

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    user,
    userPermissions,
    loading,
    login,
    signup,
    logout,
    sendPasswordReset,
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
