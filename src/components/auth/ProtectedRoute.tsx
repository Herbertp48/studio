'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { TriangleAlert } from 'lucide-react';
import { AppHeader } from '../app/header';

type ProtectedRouteProps = {
  children: React.ReactNode;
  page: 'inicio' | 'disputa' | 'sorteio' | 'ganhadores' | 'admin';
};

const pageNames = {
    inicio: "Início",
    disputa: "Disputa",
    sorteio: "Sorteio",
    ganhadores: "Ganhadores",
    admin: "Gerenciamento de Usuários"
}

export default function ProtectedRoute({ children, page }: ProtectedRouteProps) {
  const { user, userPermissions, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);


  const hasAccess = () => {
    if (!user || !userPermissions) return false;
    if (userPermissions.role === 'admin') return true;
    if (page === 'admin') return false; // Only admin can access user management
    return userPermissions.permissions?.[page] === true;
  };
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Render nothing while redirecting
  }
  
  if (!hasAccess()) {
    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <AppHeader />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
                <Card className="w-full max-w-lg border-destructive">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit">
                            <TriangleAlert className="h-10 w-10 text-destructive"/>
                        </div>
                        <CardTitle className="mt-4 text-2xl">Acesso Negado</CardTitle>
                        <CardDescription>
                            Você não tem permissão para acessar a página de "{pageNames[page]}".
                            Por favor, contate um administrador se você acredita que isso é um erro.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </main>
        </div>
    );
  }

  return <>{children}</>;
}
