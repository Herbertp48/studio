'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
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
        // Bypass Firebase DB check for temp admin
        if (user.uid === 'temp-admin-user') {
          setUserPermissions({
            role: 'admin',
            permissions: { inicio: true, disputa: true, sorteio: true, ganhadores: true },
          });
          setLoading(false);
          return;
        }

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
        if(user && user.uid !== 'temp-admin-user') {
            off(ref(database, `users/${user.uid}`));
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 const login = async (email: string, pass: string) => {
    // PROVISÓRIO: Acesso de administrador temporário
    if (email === 'admin@admin.com' && pass === 'admin123') {
      const tempUser = {
        uid: 'temp-admin-user',
        email: 'admin@admin.com',
      } as User;

      setUser(tempUser);
      // As permissões já são setadas no onAuthStateChanged
      setLoading(false);
      router.push('/');
      return; 
    }
    
    try {
      return await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);

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
          await set(ref(database, `users/${firstUser.uid}`), {
            email: firstUser.email,
            ...adminPermissions
          });
          return userCredential;
        }
      }
      throw error;
    }
  };

  const logout = () => {
    // Se o usuário for o admin temporário, apenas limpa o estado local
    if(user && user.uid === 'temp-admin-user') {
      setUser(null);
      setUserPermissions(null);
      router.push('/login');
      return Promise.resolve();
    }
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
