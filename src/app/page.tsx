'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { ParticipantGroup } from '@/components/app/participant-group';
import { Button } from '@/components/ui/button';
import { Upload, Play, UserPlus, Trash2 } from 'lucide-react';
import { read, utils } from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, set, onValue, remove } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from "@/components/ui/alert-dialog"

export type Participant = {
  id: string;
  name: string;
  stars: number;
  eliminated: boolean;
};

export default function Home() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const participantsRef = ref(database, 'participants');
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setParticipants(data.all || []);
      }
    });

    return () => unsubscribe();
  }, []);

  const updateParticipantsInDB = (newParticipants: Participant[]) => {
    set(ref(database, 'participants'), {
      all: newParticipants,
    });
  };
  
  const removeAllParticipants = () => {
    setParticipants([]);
    remove(ref(database, 'participants'));
    remove(ref(database, 'winners'));
    remove(ref(database, 'wordlists'));
    toast({
        title: 'Sucesso!',
        description: 'Todos os dados da aplicação foram removidos.',
    });
    setShowDeleteConfirm(false);
  };

  const addParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (newParticipantName.trim()) {
      const newParticipant: Participant = {
        id: `p-${Date.now()}`,
        name: newParticipantName.trim(),
        stars: 0,
        eliminated: false,
      };
      const newParticipants = [...participants, newParticipant];
      setParticipants(newParticipants);
      updateParticipantsInDB(newParticipants);
      setNewParticipantName('');
    }
  };

  const removeParticipant = (id: string) => {
    const newParticipants = participants.filter(p => p.id !== id);
    setParticipants(newParticipants);
    updateParticipantsInDB(newParticipants);
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = utils.sheet_to_json<any>(worksheet);

        if (json.length === 0) {
            throw new Error("A planilha está vazia.");
        }

        const newParticipants: Participant[] = json.map((row: any, index: number) => ({
            id: `p-${Date.now()}-${index}`,
            name: String(Object.values(row)[0]),
            stars: 0,
            eliminated: false,
        })).filter(p => p.name.trim() !== '');
        
        const updatedParticipants = [...participants, ...newParticipants];
        setParticipants(updatedParticipants);
        updateParticipantsInDB(updatedParticipants);

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

  const startDispute = () => {
     // Reset all participants stars and eliminated status before starting
    const resetedParticipants = participants.map(p => ({ ...p, stars: 0, eliminated: false }));
    updateParticipantsInDB(resetedParticipants);
    // Also clear words and dispute state
    set(ref(database, 'dispute'), null);
    remove(ref(database, 'winners'));
    router.push('/disputa');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <h2 className="text-2xl font-bold">Controles</h2>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus /> Adicionar Participante</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addParticipant} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="participant-name">Nome</Label>
                    <Input
                      id="participant-name"
                      placeholder="Nome do participante"
                      value={newParticipantName}
                      onChange={e => setNewParticipantName(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Adicionar</Button>
                </form>
              </CardContent>
            </Card>
             <div className="space-y-4">
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  className="hidden" 
                  accept=".xlsx, .xls"
                />
               <Button variant="outline" className="w-full" onClick={triggerFileUpload}>
                 <Upload className="mr-2 h-4 w-4" />
                 Importar de Excel
               </Button>
               <Button 
                className="w-full" 
                disabled={participants.length < 2}
                onClick={startDispute}
               >
                 <Play className="mr-2 h-4 w-4" />
                 Iniciar Disputa
               </Button>
               <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                  <AlertDialogTrigger asChild>
                     <Button variant="destructive" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Apagar Todos os Dados
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Todos os dados da aplicação (participantes, listas de palavras e ganhadores) serão removidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={removeAllParticipants}>Apagar Tudo</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

            </div>
          </div>
          <div className="md:col-span-2">
            <ParticipantGroup title="Participantes" participants={participants} onRemove={id => removeParticipant(id)} />
          </div>
        </div>
      </main>
    </div>
  );
}
