'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithCredential, EmailAuthCredential } from 'firebase/auth';
import { auth, database, app } from '@/lib/firebase';
import { ref, onValue, off, get, set } from 'firebase/database';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth } from 'firebase/auth';

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
  signup: (email: string, pass: string, name: string) => Promise<any>;
  logout: () => Promise<any>;
  sendPasswordReset: (email: string) => Promise<any>;
  reauthenticateAndCreateUser: (email: string, pass: string, name: string) => Promise<any>;
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
                // This might happen briefly if the DB entry isn't created yet
                // or if the user was deleted from the DB but not Auth.
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

  const reauthenticateAndCreateUser = async (email: string, pass: string, name: string) => {
    const mainUser = auth.currentUser;
    if (!mainUser) {
        throw new Error("Admin user not found");
    }

    // Create a temporary, separate Auth instance for the new user creation
    const tempAuth = getAuth(app, "tempAuthForCreation");

    try {
        // Create the new user in the temporary instance
        const newUserCredential = await createUserWithEmailAndPassword(tempAuth, email, pass);
        const newUser = newUserCredential.user;

        // Define permissions
        const newUserPermissions: UserPermissions = {
            name,
            role: 'user',
            permissions: initialPermissions,
        };

        // Save new user data to the database
        await set(ref(database, `users/${newUser.uid}`), {
            email: newUser.email,
            ...newUserPermissions
        });

    } catch (error) {
        // Propagate the error to be handled by the UI
        throw error;
    } finally {
        // Clean up the temporary auth instance. This is important!
        await signOut(tempAuth);
    }
}


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
            name,
            role: 'admin',
            permissions: { inicio: true, disputa: true, sorteio: true, ganhadores: true },
        };
    } else {
        // Subsequent users are standard users with default permissions
        permissions = {
            name,
            role: 'user',
            permissions: initialPermissions,
        };
    }

    // Save user info and permissions to the database
    await set(ref(database, `users/${newUser.uid}`), {
        email: newUser.email,
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
    reauthenticateAndCreateUser,
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
