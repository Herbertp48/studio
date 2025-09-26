'use client'

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { app, database } from '@/lib/firebase';
import { ref, onValue, set, remove as removeDb, push } from 'firebase/database';
import { createUserWithEmailAndPassword, getAuth, deleteUser } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2, UserCog } from 'lucide-react';
import type { UserPermissions } from '@/context/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export type AppUser = {
  uid: string;
  email: string;
  name?: string;
} & UserPermissions;

const initialPermissions = {
  inicio: true,
  disputa: false,
  sorteio: false,
  ganhadores: false,
};

function UsersPageContent() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.entries(data).map(([uid, userData]: [string, any]) => ({
          uid,
          ...userData,
        }));
        setUsers(userList);
      } else {
        setUsers([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha nome, e-mail e senha.' });
      return;
    }
    
    // Temporary auth instance is not needed anymore with the new signup flow.
    // We can create user and they will get default permissions.
    // This is an admin panel, so we can be more direct.
    
    try {
      // NOTE: This creates a user in Firebase Auth but doesn't sign them in in the current session.
      // This is a simplified approach. A more robust solution uses Firebase Admin SDK on a backend.
      const tempAuth = getAuth(app); // Re-using the main app's auth
      const userCredential = await createUserWithEmailAndPassword(tempAuth, newUserEmail, newUserPassword);
      const user = userCredential.user;

      const newUserPermissions: UserPermissions = {
        role: 'user',
        permissions: initialPermissions,
      };

      await set(ref(database, `users/${user.uid}`), {
        email: user.email,
        name: newUserName,
        ...newUserPermissions
      });
      
      // Since we used the main auth instance, the user is now logged in.
      // We must sign them out and restore the original admin user.
      // This is a workaround due to not having a proper backend.
      await firebaseAuth.signOut();
      // This will trigger a redirect to /login, which is not ideal but works.
      // A better UX would re-authenticate the admin silently.
      toast({ title: 'Sucesso', description: 'Usuário criado. O administrador precisa fazer login novamente.' });
      router.push('/login');


      setIsNewUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
    } catch (error: any) {
        let description = "Ocorreu um erro desconhecido.";
        switch (error.code) {
            case 'auth/email-already-in-use':
                description = "Este endereço de e-mail já está em uso por outra conta.";
                break;
            case 'auth/weak-password':
                description = "A senha é muito fraca. Por favor, use uma senha com pelo menos 6 caracteres.";
                break;
            default:
                description = error.message;
        }
        toast({ variant: 'destructive', title: 'Erro ao criar usuário', description });
    }
  };

  const handleDeleteUser = (uid: string) => {
    // Note: Deleting a user from Firebase Auth is a privileged operation
    // and should be done from a backend server (Firebase Functions). 
    // This will only remove them from the Realtime Database, which revokes their permissions.
    // The user will still exist in Firebase Authentication.
    removeDb(ref(database, `users/${uid}`)).then(() => {
        toast({ title: 'Sucesso', description: 'Usuário removido da base de dados e permissões revogadas.'});
    }).catch(err => {
        toast({ variant: 'destructive', title: 'Erro', description: err.message });
    });
  };

  const handleOpenEditDialog = (user: AppUser) => {
    setEditingUser({ 
      ...user, 
      permissions: { ...initialPermissions, ...user.permissions }
    });
    setIsEditUserDialogOpen(true);
  };
  
  const handleUpdateUserPermissions = async () => {
    if (!editingUser) return;
    try {
      const { uid, email, name, role, permissions } = editingUser;
      await set(ref(database, `users/${uid}`), {
        email,
        name,
        role,
        permissions: role === 'admin' ? { inicio: true, disputa: true, sorteio: true, ganhadores: true } : permissions
      });
      toast({ title: 'Sucesso', description: 'Permissões atualizadas.' });
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    }
  };

  const handlePermissionChange = (permission: keyof typeof initialPermissions, checked: boolean) => {
    if (!editingUser) return;
    setEditingUser(prev => ({
      ...prev!,
      permissions: {
        ...prev!.permissions,
        [permission]: checked
      }
    }));
  }

  const handleRoleChange = (isAdmin: boolean) => {
    if (!editingUser) return;
    setEditingUser(prev => ({
      ...prev!,
      role: isAdmin ? 'admin' : 'user'
    }));
  };

  const permissionLabels = {
    inicio: "Início (Gerenciar Grupos)",
    disputa: "Disputa (Gerenciar Palavras)",
    sorteio: "Sorteio (Executar Disputa)",
    ganhadores: "Ganhadores (Ver/Exportar)"
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>Gerenciamento de Usuários</CardTitle>
                 <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2" /> Novo Usuário</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Novo Usuário</DialogTitle>
                            <DialogDescription>
                                Defina o e-mail e senha para o novo acesso. As permissões podem ser editadas depois.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="new-name">Nome</Label>
                                <Input id="new-name" type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-email">E-mail</Label>
                                <Input id="new-email" type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">Senha</Label>
                                <Input id="new-password" type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                             <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancelar</Button>
                            </DialogClose>
                            <Button onClick={handleCreateUser}>Criar Usuário</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <CardDescription>{users.length} usuário(s) cadastrado(s).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {users.map(user => (
                <li key={user.uid} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="font-medium">{user.name || user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-sm font-semibold text-primary">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.uid !== firebaseAuth.currentUser?.uid && (
                        <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(user)}>
                            <UserCog className="mr-2 h-4 w-4" /> Permissões
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="destructive" size="icon" disabled={user.role === 'admin'}><Trash2 /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Apagar usuário?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tem certeza que deseja apagar o usuário {user.email}? As permissões dele serão revogadas. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.uid)}>Apagar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        </>
                    )}
                     {user.uid === firebaseAuth.currentUser?.uid && (
                        <span className="text-xs text-muted-foreground">(Você)</span>
                     )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Permissões</DialogTitle>
                    <DialogDescription>
                        Defina o nível de acesso para {editingUser?.email}.
                    </DialogDescription>
                </DialogHeader>
                {editingUser && (
                <div className="py-4 space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <Label htmlFor="admin-switch" className="text-base">Administrador</Label>
                            <p className="text-sm text-muted-foreground">
                                Concede acesso total a todas as páginas e funcionalidades.
                            </p>
                        </div>
                        <Switch
                            id="admin-switch"
                            checked={editingUser.role === 'admin'}
                            onCheckedChange={handleRoleChange}
                        />
                    </div>

                    <div className="relative">
                        <Separator />
                        <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs uppercase text-muted-foreground">Ou</div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-3 shadow-sm data-[disabled]:opacity-50" data-disabled={editingUser.role === 'admin' ? '' : undefined}>
                         <p className="text-sm font-medium text-muted-foreground">Acesso por página:</p>
                        {Object.keys(initialPermissions).map(key => {
                            const pKey = key as keyof keyof UserPermissions['permissions'];
                            return (
                                <div key={pKey} className="flex items-center space-x-3">
                                <Checkbox 
                                    id={`perm-${pKey}`}
                                    checked={editingUser.permissions?.[pKey] ?? false}
                                    onCheckedChange={(checked) => handlePermissionChange(pKey, !!checked)}
                                    disabled={editingUser.role === 'admin'}
                                />
                                <Label htmlFor={`perm-${pKey}`} className="font-medium data-[disabled]:text-muted-foreground" data-disabled={editingUser.role === 'admin' ? '' : undefined}>
                                    {permissionLabels[pKey]}
                                </Label>
                                </div>
                            )
                        })}
                    </div>
                </div>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleUpdateUserPermissions}>Salvar Alterações</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function UsersPage() {
    return (
        <ProtectedRoute page="admin">
            <UsersPageContent/>
        </ProtectedRoute>
    )
}
