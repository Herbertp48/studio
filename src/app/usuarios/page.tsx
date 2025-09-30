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
import { ref, onValue, set, remove as removeDb } from 'firebase/database';
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
import { PlusCircle, Trash2, UserCog, Send } from 'lucide-react';
import type { UserPermissions } from '@/context/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';


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
  const { user: currentUser, userPermissions: currentUserPermissions, signup, sendPasswordReset, updateUserData } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [currentUserName, setCurrentUserName] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (currentUserPermissions?.role === 'admin') {
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
    }
  }, [currentUserPermissions]);

  useEffect(() => {
    setCurrentUserName(currentUserPermissions?.name || '');
  }, [currentUserPermissions?.name])

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha nome, e-mail e senha.' });
      return;
    }
    
    try {
      // Use the signup function but flag it as an admin creation
      await signup(newUserEmail, newUserPassword, newUserName, true);
      
      toast({ title: 'Sucesso', description: 'Usuário criado com sucesso.' });
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
            case 'auth/requires-recent-login':
                description = 'Esta operação requer um login recente. Por favor, faça login novamente e tente de novo.';
                break;
            default:
                description = error.message;
        }
        toast({ variant: 'destructive', title: 'Erro ao criar usuário', description });
    }
  };

  const handleDeleteUser = (uid: string) => {
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
  
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const { uid, name, role, permissions } = editingUser;
      
      // We don't update email here as it's a sensitive operation
      const userDataToUpdate = {
        name,
        role,
        permissions: role === 'admin' ? { inicio: true, disputa: true, sorteio: true, ganhadores: true } : permissions
      }

      await updateUserData(uid, userDataToUpdate);
      
      toast({ title: 'Sucesso', description: 'Dados do usuário atualizados.' });
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

  const handleSendPasswordEmail = async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordReset(currentUser.email);
      toast({ title: 'E-mail enviado', description: 'Verifique sua caixa de entrada para redefinir sua senha.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar o e-mail de redefinição.' });
    }
  };

  const handleCurrentUserProfileUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUser) return;
      if (currentUserName === currentUserPermissions?.name) {
          toast({ variant: 'destructive', title: 'Nenhuma alteração', description: 'Você não alterou seu nome.' });
          return;
      }
      try {
          await updateUserData(currentUser.uid, { name: currentUserName });
          toast({ title: 'Sucesso!', description: 'Seu nome foi atualizado.' });
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar seu nome.' });
      }
  }


  const permissionLabels = {
    inicio: "Início (Gerenciar Grupos)",
    disputa: "Disputa (Gerenciar Palavras)",
    sorteio: "Sorteio (Executar Disputa)",
    ganhadores: "Ganhadores (Ver/Exportar)"
  }

  const renderAdminView = () => (
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
                 <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(user)}>
                    <UserCog className="mr-2 h-4 w-4" /> Editar
                </Button>
                {user.uid !== firebaseAuth.currentUser?.uid && (
                    <>
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
  );

  const renderUserView = () => (
    <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
            <CardTitle>Meu Perfil</CardTitle>
            <CardDescription>Visualize e edite suas informações e gerencie sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <form onSubmit={handleCurrentUserProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="current-username">Nome</Label>
                    <Input id="current-username" value={currentUserName || ''} onChange={(e) => setCurrentUserName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={currentUser?.email || ''} disabled />
                    <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
                </div>
                 <div className="space-y-2">
                    <Label>Nível de Acesso</Label>
                    <Input value={currentUserPermissions?.role === 'admin' ? 'Administrador' : 'Usuário'} disabled />
                </div>
                <Button type="submit">Salvar Alterações</Button>
            </form>
            
            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                    <h4 className="font-semibold">Alterar Senha</h4>
                    <p className="text-sm text-muted-foreground">
                        Um link para redefinição de senha será enviado para seu e-mail.
                    </p>
                </div>
                <Button onClick={handleSendPasswordEmail}><Send className="mr-2 h-4 w-4"/> Enviar Link</Button>
            </div>
        </CardContent>
    </Card>
  );


  return (
    <div className="flex flex-col w-full bg-background text-foreground">
      <AppHeader />
      <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUserPermissions?.role === 'admin' ? renderAdminView() : renderUserView()}

        {/* Edit Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Usuário</DialogTitle>
                    <DialogDescription>
                        Altere os dados e o nível de acesso para {editingUser?.email}.
                    </DialogDescription>
                </DialogHeader>
                {editingUser && (
                <div className="py-4 space-y-6">
                    <div className='space-y-2'>
                        <Label htmlFor='edit-username'>Nome</Label>
                        <Input 
                            id='edit-username'
                            value={editingUser.name || ''}
                            onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <Label htmlFor="admin-switch" className="text-base">Administrador</Label>
                            <p className="text-sm text-muted-foreground">
                                Concede acesso total a todas as funcionalidades.
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
                            const pKey = key as keyof UserPermissions['permissions'];
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
                    <Button onClick={handleUpdateUser}>Salvar Alterações</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function UsersPage() {
    return (
        <ProtectedRoute page="inicio">
            <UsersPageContent/>
        </ProtectedRoute>
    )
}
