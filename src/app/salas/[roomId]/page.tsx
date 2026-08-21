'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Trash2, PlusCircle, Upload, Play, Search, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, set, onValue, push, remove as removeDb, update, get, child } from 'firebase/database';
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
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Checkbox } from '@/components/ui/checkbox';
import { read, utils } from 'xlsx';
import { Badge } from '@/components/ui/badge';

export type Participant = {
  id: string;
  name: string;
  stars: number;
  eliminated: boolean;
};

export type ParticipantGroup = {
  id: string;
  name: string;
  participants: { [key: string]: Participant };
}

function RoomDetailPageContent() {
  const params = useParams();
  const roomId = params.roomId as string;
  
  const [participantGroups, setParticipantGroups] = useState<ParticipantGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [participantsToMigrate, setParticipantsToMigrate] = useState<string[]>([]);
  const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);
  const [migrationTargetGroup, setMigrationTargetGroup] = useState('');
  const [newMigrationGroupName, setNewMigrationGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [globalGroups, setGlobalGroups] = useState<ParticipantGroup[]>([]);
  const [isLinkGroupDialogOpen, setIsLinkGroupDialogOpen] = useState(false);
  const [selectedGlobalGroupId, setSelectedGlobalGroupId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const selectedGroup = participantGroups.find(group => group.id === selectedGroupId);
  const selectedGroupParticipants = selectedGroup ? Object.values(selectedGroup.participants || {}) : [];
  
  const filteredParticipants = selectedGroupParticipants.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const activeParticipantsCount = selectedGroupParticipants.filter(p => !p.eliminated).length;
  const inactiveParticipantsCount = selectedGroupParticipants.length - activeParticipantsCount;

  useEffect(() => {
    // Listen to room info
    const roomRef = ref(database, `rooms/${roomId}`);
    const unsubscribeRoom = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomName(data.name || 'Sala');
      }
    });

    // Listen to participant groups for this room
    const groupsRef = ref(database, `rooms/${roomId}/participant-groups`);
    const unsubscribeGroups = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const groups: ParticipantGroup[] = Object.entries(data).map(([id, group]: [string, any]) => ({
          id,
          name: group.name,
          participants: group.participants || {},
        }));
        setParticipantGroups(groups);
        if (!selectedGroupId && groups.length > 0) {
          setSelectedGroupId(groups[0].id);
        } else if (groups.length === 0) {
          setSelectedGroupId(null);
        }
      } else {
        setParticipantGroups([]);
        setSelectedGroupId(null);
      }
    });

    // Listen to global participant groups
    const globalGroupsRef = ref(database, 'participant-groups');
    const unsubscribeGlobalGroups = onValue(globalGroupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const groups: ParticipantGroup[] = Object.entries(data).map(([id, group]: [string, any]) => ({
          id,
          name: group.name,
          participants: group.participants || {},
        }));
        setGlobalGroups(groups);
      } else {
        setGlobalGroups([]);
      }
    });

    return () => {
      unsubscribeRoom();
      unsubscribeGroups();
      unsubscribeGlobalGroups();
    };
  }, [roomId]);

  useEffect(() => {
    if (editingParticipant) {
      setIsEditDialogOpen(true);
    } else {
      setIsEditDialogOpen(false);
    }
  }, [editingParticipant]);

  useEffect(() => {
    setParticipantsToMigrate([]);
  }, [selectedGroupId]);

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O nome do grupo não pode estar vazio.'});
      return;
    }
    const newGroupRef = push(ref(database, `rooms/${roomId}/participant-groups`));
    set(newGroupRef, { name: newGroupName.trim(), participants: {} });
    setNewGroupName('');
    toast({ title: 'Sucesso!', description: `O grupo "${newGroupName.trim()}" foi criado.`});
  }

  const handleDeleteGroup = (groupId: string) => {
    removeDb(ref(database, `rooms/${roomId}/participant-groups/${groupId}`));
    toast({ title: 'Sucesso!', description: 'O grupo foi removido.'});
    if (selectedGroupId === groupId) {
      const remainingGroups = participantGroups.filter(g => g.id !== groupId);
      setSelectedGroupId(remainingGroups.length > 0 ? remainingGroups[0].id : null);
    }
  }

  const addParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (newParticipantName.trim() && selectedGroup) {
      const groupParticipantsRef = ref(database, `rooms/${roomId}/participant-groups/${selectedGroup.id}/participants`);
      const newParticipantRef = push(groupParticipantsRef);
      
      const newParticipant: Participant = {
        id: newParticipantRef.key!,
        name: newParticipantName.trim(),
        stars: 0,
        eliminated: false,
      };

      set(newParticipantRef, newParticipant);
      setNewParticipantName('');
    }
  };

  const removeParticipant = (participantId: string) => {
    if (selectedGroup) {
      removeDb(ref(database, `rooms/${roomId}/participant-groups/${selectedGroup.id}/participants/${participantId}`));
    }
  };

  const clearParticipants = () => {
    if (selectedGroup) {
      removeDb(ref(database, `rooms/${roomId}/participant-groups/${selectedGroup.id}/participants`));
      toast({ title: 'Sucesso!', description: `Todos os participantes do grupo "${selectedGroup.name}" foram removidos.`});
    }
  };

  const handleEditParticipant = (participant: Participant) => {
    if (!selectedGroup) return;
    const participantRef = ref(database, `rooms/${roomId}/participant-groups/${selectedGroup.id}/participants/${participant.id}`);
    update(participantRef, participant).then(() => {
      toast({ title: 'Sucesso', description: `Participante "${participant.name}" atualizado.` });
      setEditingParticipant(null);
    }).catch((error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    });
  }

  const handleToggleParticipantStatus = (participant: Participant, isChecked: boolean) => {
    if (!selectedGroup) return;

    const updatedParticipant = {
      ...participant,
      eliminated: !isChecked,
      stars: !isChecked ? participant.stars : 0,
    };

    const participantRef = ref(database, `rooms/${roomId}/participant-groups/${selectedGroup.id}/participants/${participant.id}`);
    update(participantRef, updatedParticipant);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setParticipantsToMigrate(filteredParticipants.map(p => p.id));
    } else {
      setParticipantsToMigrate([]);
    }
  };

  const handleLinkGlobalGroup = () => {
    if (!selectedGlobalGroupId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um grupo global para vincular.' });
      return;
    }

    const globalGroup = globalGroups.find(g => g.id === selectedGlobalGroupId);
    if (!globalGroup) return;

    // Create a copy of the global group in this room
    const newGroupRef = push(ref(database, `rooms/${roomId}/participant-groups`));
    
    // Copy participants with new IDs
    const participantsCopy: { [key: string]: Participant } = {};
    Object.values(globalGroup.participants || {}).forEach(participant => {
      const newParticipantRef = push(ref(database, `rooms/${roomId}/participant-groups/${newGroupRef.key}/participants`));
      const newParticipantId = newParticipantRef.key!;
      participantsCopy[newParticipantId] = {
        ...participant,
        id: newParticipantId
      };
    });

    set(newGroupRef, {
      name: `${globalGroup.name} (Vinculado)`,
      participants: participantsCopy
    });

    toast({ title: 'Sucesso!', description: `Grupo "${globalGroup.name}" vinculado à sala com sucesso!` });
    setIsLinkGroupDialogOpen(false);
    setSelectedGlobalGroupId('');
  };

  const startDispute = () => {
    if (!selectedGroupId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um grupo de participantes.' });
      return;
    }
    
    const selectedGroup = participantGroups.find(g => g.id === selectedGroupId);
    if (!selectedGroup) return;

    const activeParticipants = Object.values(selectedGroup.participants || {}).filter(p => !p.eliminated);
    
    if (activeParticipants.length < 2) {
      toast({ variant: 'destructive', title: 'Erro', description: 'São necessários pelo menos 2 participantes ativos.' });
      return;
    }

    // Initialize dispute for this room only
    set(ref(database, `rooms/${roomId}/dispute`), {
      participants: activeParticipants.reduce((acc, p) => {
        acc[p.id] = { ...p, stars: 0 };
        return acc;
      }, {} as { [key: string]: Participant }),
    });
    
    router.push(`/salas/${roomId}/sorteio`);
  };

  return (
    <div className="flex flex-col w-full bg-background text-foreground">
      <AppHeader />
      <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sala: {roomName}</h1>
            <p className="text-muted-foreground">ID da Sala: <code className="bg-muted px-2 py-0.5 rounded">{roomId}</code></p>
          </div>
          <Button onClick={() => router.push('/salas')} variant="outline">
            Voltar às Salas
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Users /> Grupos</div>
                  <div className="flex gap-2">
                    <Dialog open={isLinkGroupDialogOpen} onOpenChange={setIsLinkGroupDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><LinkIcon className="mr-2 h-4 w-4" /> Vincular</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Vincular Grupo Global</DialogTitle>
                          <DialogDescription>
                            Selecione um grupo global para copiar e vincular a esta sala.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          {globalGroups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum grupo global encontrado.</p>
                          ) : (
                            <Select value={selectedGlobalGroupId} onValueChange={setSelectedGlobalGroupId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um grupo" />
                              </SelectTrigger>
                              <SelectContent>
                                {globalGroups.map(group => (
                                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="secondary">Cancelar</Button>
                          </DialogClose>
                          <Button onClick={handleLinkGlobalGroup} disabled={!selectedGlobalGroupId}>
                            Vincular Grupo
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm"><PlusCircle className="mr-2" /> Novo</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Criar Novo Grupo</AlertDialogTitle>
                          <AlertDialogDescription>
                            <Input 
                              placeholder="Nome do novo grupo"
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              className="mt-4"
                            />
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Criar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Select onValueChange={setSelectedGroupId} value={selectedGroupId || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {participantGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGroupId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon"><Trash2 /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita. O grupo "{selectedGroup?.name}" e todos os seus participantes serão removidos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteGroup(selectedGroupId!)}>Apagar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Button 
                className="w-full" 
                onClick={startDispute}
                disabled={!selectedGroupId}
              >
                <Play className="mr-2 h-4 w-4" />
                Iniciar Disputa
              </Button>
            </div>
          </div>

          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Participantes do grupo "{selectedGroup?.name || 'Nenhum'}"</CardTitle>
                <CardDescription>
                  {selectedGroupParticipants.length || 0} participante(s)
                  {selectedGroupParticipants.length > 0 && (
                    ` (${activeParticipantsCount} ativos, ${inactiveParticipantsCount} inativos)`
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedGroupId ? (
                  <>
                    <form onSubmit={addParticipant} className="flex gap-2 mb-4">
                      <Input
                        id="participant-name"
                        placeholder="Nome do participante"
                        value={newParticipantName}
                        onChange={e => setNewParticipantName(e.target.value)}
                        required
                      />
                      <Button type="submit"><Users /></Button>
                    </form>

                    <div className="relative mb-4">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar participante..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {filteredParticipants.map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={!participant.eliminated}
                                onCheckedChange={(checked) =>
                                  handleToggleParticipantStatus(participant, checked as boolean)
                                }
                              />
                              <span className={participant.eliminated ? 'line-through text-muted-foreground' : ''}>
                                {participant.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                <span className="flex items-center gap-1">
                                  ⭐ {participant.stars}
                                </span>
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingParticipant(participant)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Selecione ou crie um grupo para começar
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Participant Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Participante</DialogTitle>
            <DialogDescription>
              Faça alterações no participante aqui.
            </DialogDescription>
          </DialogHeader>
          {editingParticipant && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editingParticipant.name}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-stars">Estrelas</Label>
                <Input
                  id="edit-stars"
                  type="number"
                  min="0"
                  value={editingParticipant.stars}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, stars: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={() => editingParticipant && handleEditParticipant(editingParticipant)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RoomDetailPage() {
  return (
    <ProtectedRoute page="salas">
      <RoomDetailPageContent />
    </ProtectedRoute>
  );
}
