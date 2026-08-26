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
        salas: boolean;
        disputa: boolean;
        sorteio: boolean;
        ganhadores: boolean;
    }
}

const initialPermissions = {
  inicio: true,
  salas: true,
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
        if (pathname !== '/login' && pathname !== '/projetor') {
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

    // Generate a random password if admin is creating the user
    const passwordToUse = isAdminCreation 
      ? pass || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
      : pass;

    let userCredential;
    let newUser;

    // If admin is creating the user, only save to database (don't create in Auth)
    // The user account will be created when they first login with the temporary password
    if (isAdminCreation) {
      // Admin creating user - only save to database
      let permissions: UserPermissions = {
        name,
        role: 'user',
        permissions: initialPermissions,
      };

      // Create a placeholder in database with email and permissions
      // The actual auth account will be created on first login
      const tempUid = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(-6);
      
      // We need to use a different approach: save user data with email as key temporarily
      // Then when user logs in for the first time, we'll create the proper account
      
      // Actually, better approach: use Firebase Admin SDK capabilities through callable function
      // But since we don't have that, we'll use a workaround:
      // Save user data in a pending_users node, and handle on first login
      
      await set(ref(database, `pending_users/${email.replace(/\./g, ',')}`), {
        email,
        tempPassword: passwordToUse,
        ...permissions,
        createdAt: Date.now()
      });
      
      return { user: { email, uid: tempUid } };
    }

    // Regular self-registration (first user or public signup)
    userCredential = await createUserWithEmailAndPassword(auth, email, passwordToUse);
    newUser = userCredential.user;

    let permissions: UserPermissions;

    if (isFirstUser) {
        permissions = {
            name,
            role: 'admin',
            permissions: { inicio: true, salas: true, disputa: true, sorteio: true, ganhadores: true },
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
    
    await signOut(auth);

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
