'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, onValue, off, get, set, update } from 'firebase/database';
import { useRouter, usePathname } from 'next/navigation';

export interface UserPermissions {
    name: string;
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
  signup: (email: string, pass: string, name: string, isAdminCreation?: boolean) => Promise<any>;
  logout: () => Promise<any>;
  sendPasswordReset: (email: string) => Promise<any>;
  updateUserData: (uid: string, data: Partial<UserPermissions>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userPermsRef = ref(database, `users/${currentUser.uid}`);
        onValue(userPermsRef, (snapshot) => {
            const perms = snapshot.val();
            setUserPermissions(perms);
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
  
  const signup = async (email: string, pass: string, name: string, isAdminCreation = false) => {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    const isFirstUser = !snapshot.exists();

    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

    let permissions: UserPermissions;

    if (isFirstUser && !isAdminCreation) {
        permissions = {
            name,
            role: 'admin',
            permissions: { inicio: true, disputa: true, sorteio: true, ganhadores: true },
        };
    } else {
        permissions = {
            name,
            role: 'user',
            permissions: initialPermissions,
        };
    }

    await set(ref(database, `users/${newUser.uid}`), {
        email: newUser.email,
        ...permissions
    });
    
    // Only sign out if it's a public sign-up page. Admin creating a user should not be signed out.
    if (!isAdminCreation) {
        await signOut(auth);
    }

    return userCredential;
  }
  
  const updateUserData = (uid: string, data: Partial<UserPermissions>) => {
    const userRef = ref(database, `users/${uid}`);
    return update(userRef, data);
  };

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
    updateUserData,
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
