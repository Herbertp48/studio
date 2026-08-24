'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Users, Eye, Trash2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, set, onValue, push, remove as removeDb, get, update } from 'firebase/database';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { UserPermissions } from '@/context/AuthContext';

export type AppUser = {
  uid: string;
  email: string;
  name?: string;
} & UserPermissions;

export type Room = {
  id: string;
  name: string;
  createdAt: number;
  status: 'waiting' | 'in_progress' | 'finished';
  participantCount: number;
  allowedUsers?: string[];
}

function RoomsPageContent() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isCreateRoomDialogOpen, setIsCreateRoomDialogOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const roomsRef = ref(database, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const roomsData: Room[] = Object.entries(data).map(([id, room]: [string, any]) => ({
          id,
          name: room.name,
          createdAt: room.createdAt || Date.now(),
          status: room.status || 'waiting',
          participantCount: room.participantCount || 0,
          allowedUsers: room.allowedUsers || [],
        }));
        setRooms(roomsData.sort((a, b) => b.createdAt - a.createdAt));
      } else {
        setRooms([]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const usersData: AppUser[] = Object.entries(data).map(([uid, userData]: [string, any]) => ({
          uid,
          ...userData,
        }));
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O nome da sala não pode estar vazio.'});
      return;
    }

    const newRoomRef = push(ref(database, 'rooms'));
    const roomId = newRoomRef.key;
    
    if (roomId) {
      set(newRoomRef, {
        name: newRoomName.trim(),
        createdAt: Date.now(),
        status: 'waiting',
        participantCount: 0,
        allowedUsers: selectedUsers.length > 0 ? selectedUsers : null,
      });

      // Initialize room structure
      set(ref(database, `rooms/${roomId}/participant-groups`), {});
      set(ref(database, `rooms/${roomId}/wordlists`), {});
      set(ref(database, `rooms/${roomId}/dispute`), null);
      
      toast({ title: 'Sucesso!', description: `Sala "${newRoomName.trim()}" criada com ID: ${roomId}`});
      setNewRoomName('');
      setSelectedUsers([]);
      setIsCreateRoomDialogOpen(false);
    }
  };

  const handleDeleteRoom = (roomId: string, roomName: string) => {
    removeDb(ref(database, `rooms/${roomId}`));
    toast({ title: 'Sucesso!', description: `Sala "${roomName}" removida.`});
  };

  const handleEnterRoom = (roomId: string) => {
    router.push(`/salas/${roomId}`);
  };

  const handleStartDispute = (roomId: string) => {
    router.push(`/salas/${roomId}`);
  };

  const handleViewOverview = (roomId: string) => {
    router.push(`/salas/${roomId}/projetor`);
  };

  return (
    <div className="flex flex-col w-full bg-background text-foreground">
      <AppHeader />
      <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-6">Gerenciar Salas</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Create Room Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle /> Criar Nova Sala
              </CardTitle>
              <CardDescription>
                Crie uma nova sala para uma disputa independente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="room-name">Nome da Sala</Label>
                  <Input
                    id="room-name"
                    placeholder="Ex: Sala 3, Turma A, etc."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <Dialog open={isCreateRoomDialogOpen} onOpenChange={setIsCreateRoomDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" disabled={!newRoomName.trim()}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Selecionar Usuários e Criar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Selecionar Usuários com Acesso</DialogTitle>
                      <DialogDescription>
                        Selecione quais usuários terão acesso a esta sala. Se nenhum usuário for selecionado, todos os usuários terão acesso.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-2">
                        {users.map((user) => (
                          <div
                            key={user.uid}
                            className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <Checkbox
                              id={`user-${user.uid}`}
                              checked={selectedUsers.includes(user.uid)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUsers([...selectedUsers, user.uid]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.uid));
                                }
                              }}
                            />
                            <label
                              htmlFor={`user-${user.uid}`}
                              className="flex flex-col cursor-pointer"
                            >
                              <span className="font-medium text-sm">{user.name || user.email}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </label>
                          </div>
                        ))}
                        {users.length === 0 && (
                          <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                            Nenhum usuário cadastrado.
                          </p>
                        )}
                      </div>
                      {selectedUsers.length > 0 && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium">
                            {selectedUsers.length} usuário(s) selecionado(s)
                          </p>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                      </DialogClose>
                      <Button onClick={handleCreateRoom}>Criar Sala</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Join Room Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users /> Entrar em Sala Existente
              </CardTitle>
              <CardDescription>
                Acesse uma sala usando o ID dela
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="room-code">ID da Sala</Label>
                  <Input
                    id="room-code"
                    placeholder="Cole o ID da sala aqui"
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <Button 
                  onClick={() => joinRoomCode && handleEnterRoom(joinRoomCode)} 
                  className="w-full" 
                  disabled={!joinRoomCode.trim()}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Entrar na Sala
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rooms List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users /> Salas Existentes
            </CardTitle>
            <CardDescription>
              Visualize e gerencie todas as salas criadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma sala criada ainda. Crie sua primeira sala acima!
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{room.name}</span>
                          <Badge variant={room.status === 'in_progress' ? 'default' : room.status === 'finished' ? 'secondary' : 'outline'}>
                            {room.status === 'waiting' ? 'Aguardando' : room.status === 'in_progress' ? 'Em Disputa' : 'Finalizada'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {room.participantCount} participante(s)
                          </span>
                          <span>ID: <code className="bg-muted px-2 py-0.5 rounded text-xs">{room.id}</code></span>
                          {room.allowedUsers && room.allowedUsers.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {room.allowedUsers.length} usuário(s) com acesso
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnterRoom(room.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleStartDispute(room.id)}
                          disabled={room.status === 'finished'}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Disputar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewOverview(room.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Projetor
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. A sala "{room.name}" e todos os seus dados serão removidos permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRoom(room.id, room.name)}>
                                Apagar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <ProtectedRoute page="salas">
      <RoomsPageContent />
    </ProtectedRoute>
  );
}
