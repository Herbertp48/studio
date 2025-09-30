'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgotPassword'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup, sendPasswordReset } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha no login',
        description: error.code === 'auth/invalid-credential' 
          ? 'E-mail ou senha inválidos.' 
          : 'Verifique seu e-mail e senha e tente novamente.',
      });
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erro no cadastro',
        description: 'As senhas não coincidem.',
      });
      return;
    }
    setIsLoading(true);
    try {
      await signup(email, password, name);
      toast({
        title: 'Cadastro realizado com sucesso!',
        description: 'Você já pode fazer o login.',
      });
      setAuthMode('login');
    } catch (error: any) {
        let description = "Ocorreu um erro desconhecido.";
        switch (error.code) {
            case 'auth/email-already-in-use':
                description = "Este endereço de e-mail já está em uso por outra conta.";
                break;
            case 'auth/weak-password':
                description = "A senha é muito fraca. A senha deve ter pelo menos 6 caracteres.";
                break;
            default:
                description = "Não foi possível concluir o cadastro.";
        }
      toast({
        variant: 'destructive',
        title: 'Falha no cadastro',
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await sendPasswordReset(email);
      toast({
        title: 'E-mail enviado',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
      setAuthMode('login');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao enviar e-mail',
        description: 'Não foi possível encontrar um usuário com este e-mail.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const renderContent = () => {
    switch (authMode) {
      case 'signup':
        return (
          <>
            <CardHeader className="text-center">
              <CardTitle>Cadastro</CardTitle>
              <CardDescription>Crie sua conta para acessar o painel.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
                 <Button variant="link" className="w-full" onClick={() => setAuthMode('login')}>
                    Já tem uma conta? Faça login.
                </Button>
              </form>
            </CardContent>
          </>
        );
      case 'forgotPassword':
        return (
           <>
            <CardHeader className="text-center">
              <CardTitle>Esqueci minha senha</CardTitle>
              <CardDescription>Digite seu e-mail para receber o link de redefinição.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading}/>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Enviando...' : 'Enviar e-mail de redefinição'}
                </Button>
                <Button variant="link" className="w-full" onClick={() => setAuthMode('login')}>
                    Voltar para o login
                </Button>
              </form>
            </CardContent>
          </>
        );
      case 'login':
      default:
        return (
          <>
            <CardHeader className="text-center">
              <CardTitle>Login</CardTitle>
              <CardDescription>Acesse o painel de gerenciamento.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
                <div className="text-sm text-center">
                    <Button variant="link" className="px-1" onClick={() => setAuthMode('forgotPassword')}>Esqueci minha senha</Button>
                </div>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Ou</span>
                    </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setAuthMode('signup')}>
                    Não tem uma conta? Cadastre-se
                </Button>
              </form>
            </CardContent>
          </>
        );
    }
  }


  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
            <div className="flex justify-center items-center gap-2 pt-6">
                    <Image src="/images/bee.png" alt="Spelling Bee" width={32} height={32} />
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Spelling Bee
                </h1>
            </div>
            {renderContent()}
        </Card>
      </main>
    </div>
  );
}
