'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Upload, Play, UserPlus, Trash2, List, PlusCircle, Edit } from 'lucide-react';
import { read, utils } from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, set, onValue, remove as removeDb, push, update } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';


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

function HomePageContent() {
  const [participantGroups, setParticipantGroups] = useState<ParticipantGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const selectedGroup = participantGroups.find(group => group.id === selectedGroupId);
  const selectedGroupParticipants = selectedGroup ? Object.values(selectedGroup.participants || {}) : [];

  useEffect(() => {
    const groupsRef = ref(database, 'participant-groups');
    const unsubscribe = onValue(groupsRef, (snapshot) => {
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

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (editingParticipant) {
      setIsEditDialogOpen(true);
    } else {
      setIsEditDialogOpen(false);
    }
  }, [editingParticipant]);
  
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O nome do grupo não pode estar vazio.'});
        return;
    }
    const newGroupRef = push(ref(database, 'participant-groups'));
    set(newGroupRef, { name: newGroupName.trim(), participants: {} });
    setNewGroupName('');
    toast({ title: 'Sucesso!', description: `O grupo "${newGroupName.trim()}" foi criado.`});
  }

  const handleDeleteGroup = (groupId: string) => {
    removeDb(ref(database, `participant-groups/${groupId}`));
    toast({ title: 'Sucesso!', description: 'O grupo foi removido.'});
    if (selectedGroupId === groupId) {
        const remainingGroups = participantGroups.filter(g => g.id !== groupId);
        setSelectedGroupId(remainingGroups.length > 0 ? remainingGroups[0].id : null);
    }
  }

  const addParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (newParticipantName.trim() && selectedGroup) {
      const groupParticipantsRef = ref(database, `participant-groups/${selectedGroup.id}/participants`);
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
        removeDb(ref(database, `participant-groups/${selectedGroup.id}/participants/${participantId}`));
    }
  };

  const clearParticipants = () => {
    if (selectedGroup) {
        removeDb(ref(database, `participant-groups/${selectedGroup.id}/participants`));
        toast({ title: 'Sucesso!', description: `Todos os participantes do grupo "${selectedGroup.name}" foram removidos.`});
    }
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedGroupId) {
      toast({ variant: "destructive", title: 'Nenhum grupo selecionado', description: 'Selecione um grupo antes de importar participantes.' });
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = utils.sheet_to_json<any>(worksheet, { header: 1 });

        const participantsToImport: Omit<Participant, 'id'>[] = json.map((row: any) => ({
            name: String(row[0] || '').trim(),
            stars: 0,
            eliminated: false,
        })).filter(p => p.name.length > 0);
        
        if (selectedGroup) {
            const updates: {[key: string]: any} = {};
            participantsToImport.forEach(p => {
                const newParticipantRef = push(ref(database, `participant-groups/${selectedGroup.id}/participants`));
                updates[`participant-groups/${selectedGroup.id}/participants/${newParticipantRef.key!}`] = {
                  ...p, 
                  id: newParticipantRef.key
                };
            })
            update(ref(database), updates);
        }

        toast({
          title: 'Sucesso!',
          description: 'Participantes importados com sucesso.',
        });

      } catch (error) {
        let errorMessage = 'Não foi possível ler o arquivo. Verifique o formato e tente novamente.';
        if(error instanceof Error) {
            errorMessage = error.message;
        }
        console.error("Erro ao importar arquivo:", error);
        toast({
          variant: "destructive",
          title: 'Erro de Importação',
          description: errorMessage,
        });
      } finally {
        if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };
  
  const handleEditParticipant = (participant: Participant) => {
    if (!selectedGroup) return;
    const participantRef = ref(database, `participant-groups/${selectedGroup.id}/participants/${participant.id}`);
    update(participantRef, participant).then(() => {
        toast({ title: 'Sucesso', description: `Participante "${participant.name}" atualizado.` });
        setEditingParticipant(null);
    }).catch((error) => {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    });
  }

  const startDispute = () => {
    set(ref(database, 'dispute'), null);
    removeDb(ref(database, 'winners'));
    router.push('/disputa');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><List /> Grupos</div>
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
                >
                <Play className="mr-2 h-4 w-4" />
                Ir para Disputa
                </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Participantes do grupo "{selectedGroup?.name || 'Nenhum'}"</CardTitle>
                    <CardDescription>{selectedGroupParticipants.length || 0} participante(s)</CardDescription>
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
                            <Button type="submit"><UserPlus /></Button>
                        </form>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                             <Button variant="outline" className="w-full" onClick={triggerFileUpload}>
                                <Upload className="mr-2 h-4 w-4" />
                                Importar de Excel
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full" disabled={!selectedGroup || selectedGroupParticipants.length === 0}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Apagar Participantes
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Apagar todos os participantes?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Tem certeza que deseja apagar todos os participantes do grupo "{selectedGroup?.name}"? Essa ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={clearParticipants}>Apagar Todos</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                        </div>

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload}
                            className="hidden" 
                            accept=".xlsx, .xls"
                        />

                        <ScrollArea className="h-[45vh]">
                            <ul className="space-y-2">
                                {selectedGroupParticipants.length > 0 ? (
                                selectedGroupParticipants.map(p => (
                                    <li
                                    key={p.id}
                                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                                    >
                                    <span className={`font-medium ${p.eliminated ? 'line-through text-muted-foreground' : ''}`}>{p.name}</span>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingParticipant(p)}>
                                           <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeParticipant(p.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    </li>
                                ))
                                ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Nenhum participante neste grupo.
                                </p>
                                )}
                            </ul>
                        </ScrollArea>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-10">
                            {participantGroups.length > 0 ? 'Selecione um grupo para começar.' : 'Crie um novo grupo para adicionar participantes.'}
                        </p>
                    )}
                </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => !isOpen && setEditingParticipant(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Participante</DialogTitle>
                    <DialogDescription>Altere os dados de {editingParticipant?.name}.</DialogDescription>
                </DialogHeader>
                {editingParticipant && (
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nome</Label>
                            <Input 
                                id="edit-name"
                                value={editingParticipant.name}
                                onChange={(e) => setEditingParticipant({...editingParticipant, name: e.target.value})}
                            />
                        </div>
                         <div className="flex items-center space-x-2">
                            <Switch 
                                id="eliminated-switch"
                                checked={!editingParticipant.eliminated}
                                onCheckedChange={(checked) => setEditingParticipant({...editingParticipant, eliminated: !checked, stars: 0 })}
                            />
                            <Label htmlFor="eliminated-switch">{editingParticipant.eliminated ? "Reativar Participante" : "Participante Ativo"}</Label>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={() => editingParticipant && handleEditParticipant(editingParticipant)}>Salvar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}


export default function Home() {
    return (
        <ProtectedRoute page="inicio">
            <HomePageContent />
        </ProtectedRoute>
    )
}
