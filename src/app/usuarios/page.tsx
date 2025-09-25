'use client'

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, onValue, set, remove as removeDb, push } from 'firebase/database';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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

export type AppUser = {
  uid: string;
  email: string;
} & UserPermissions;

const initialPermissions = {
  inicio: false,
  disputa: false,
  sorteio: false,
  ganhadores: false,
};

function UsersPageContent() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
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
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha e-mail e senha.' });
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, newUserEmail, newUserPassword);
      const user = userCredential.user;
      
      const newUserPermissions: UserPermissions = {
        role: 'user',
        permissions: initialPermissions,
      };

      await set(ref(database, `users/${user.uid}`), {
        email: user.email,
        ...newUserPermissions
      });

      toast({ title: 'Sucesso', description: 'Usuário criado com sucesso.' });
      setIsNewUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao criar usuário', description: error.message });
    }
  };

  const handleDeleteUser = (uid: string) => {
    // Note: Deleting a user from Firebase Auth is a privileged operation
    // and should be done from a backend server. Here we only remove from DB.
    removeDb(ref(database, `users/${uid}`)).then(() => {
        toast({ title: 'Sucesso', description: 'Usuário removido da base de dados.'});
    }).catch(err => {
        toast({ variant: 'destructive', title: 'Erro', description: err.message });
    });
  };

  const handleOpenEditDialog = (user: AppUser) => {
    setEditingUser({ ...user, permissions: { ...initialPermissions, ...user.permissions }});
    setIsEditUserDialogOpen(true);
  };
  
  const handleUpdateUserPermissions = async () => {
    if (!editingUser) return;
    try {
      await set(ref(database, `users/${editingUser.uid}`), {
        email: editingUser.email,
        role: editingUser.role,
        permissions: editingUser.permissions
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
                    <p className="font-medium">{user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.role !== 'admin' && (
                        <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(user)}>
                            <UserCog className="mr-2 h-4 w-4" /> Permissões
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="destructive" size="icon"><Trash2 /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Apagar usuário?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tem certeza que deseja apagar o usuário {user.email}? Essa ação não pode ser desfeita.
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
                        Defina as páginas que {editingUser?.email} pode acessar.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                   {editingUser && Object.keys(initialPermissions).map(key => {
                     const pKey = key as keyof typeof initialPermissions;
                     return (
                        <div key={pKey} className="flex items-center space-x-3">
                           <Checkbox 
                                id={`perm-${pKey}`}
                                checked={editingUser.permissions?.[pKey]}
                                onCheckedChange={(checked) => handlePermissionChange(pKey, !!checked)}
                           />
                           <Label htmlFor={`perm-${pKey}`} className="font-medium">
                            {permissionLabels[pKey]}
                           </Label>
                        </div>
                     )
                   })}
                </div>
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
