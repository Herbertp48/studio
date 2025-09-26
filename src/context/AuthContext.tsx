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
  signup: (email: string, pass: string, name: string) => Promise<any>;
  logout: () => Promise<any>;
  sendPasswordReset: (email: string) => Promise<any>;
  reauthenticateAndCreateUser: (email: string, pass: string, name: string) => Promise<any>;
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

  const reauthenticateAndCreateUser = async (email: string, pass: string, name: string) => {
     if (!auth.currentUser) throw new Error("Usuário principal não autenticado.");

    // Manter o usuário atual
    const mainUser = auth.currentUser;

    try {
        // Criar o novo usuário. O Firebase NÃO faz login automático neste fluxo se já houver um usuário logado.
        const newUserCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const newUser = newUserCredential.user;

        // Definir permissões
        const newUserPermissions = {
            name,
            role: 'user',
            permissions: initialPermissions,
        };

        // Salvar dados do novo usuário no banco de dados
        await set(ref(database, `users/${newUser.uid}`), {
            email: newUser.email,
            ...newUserPermissions
        });

        // Garantir que o admin continue logado. Isso pode ser visto como uma re-autenticação forçada,
        // mas na prática, como nada mudou para o admin, ele permanece logado sem interrupções.
        // O `auth.currentUser` deve permanecer o mesmo `mainUser`.
        if (auth.currentUser?.uid !== mainUser.uid) {
           // Isso seria um cenário inesperado, mas como salvaguarda:
           await signOut(auth);
           // Idealmente, forçar o login do admin de novo, mas isso complica a UI.
           // Por enquanto, vamos lançar um erro para indicar que algo deu errado.
           throw new Error("A sessão do administrador foi perdida durante a criação do usuário.");
        }

    } catch (error) {
        throw error;
    }
  }

  const signup = async (email: string, pass: string, name: string) => {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    const isFirstUser = !snapshot.exists();

    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

    let permissions: UserPermissions;

    if (isFirstUser) {
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
    reauthenticateAndCreateUser,
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
