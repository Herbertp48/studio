'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { ParticipantGroup } from '@/components/app/participant-group';
import { AddParticipantForm } from '@/components/app/add-participant-form';
import { Button } from '@/components/ui/button';
import { Upload, Play } from 'lucide-react';
import { read, utils } from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, set, onValue, get, child } from 'firebase/database';

export type Participant = {
  id: string;
  name: string;
  stars: number;
  eliminated: boolean;
};

export default function Home() {
  const [groupA, setGroupA] = useState<Participant[]>([]);
  const [groupB, setGroupB] = useState<Participant[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const participantsRef = ref(database, 'participants');
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGroupA(data.groupA || []);
        setGroupB(data.groupB || []);
      }
    });

    return () => unsubscribe();
  }, []);

  const updateParticipantsInDB = (newGroupA: Participant[], newGroupB: Participant[]) => {
    set(ref(database, 'participants'), {
      groupA: newGroupA,
      groupB: newGroupB,
    });
  };

  const addParticipant = (name: string, group: 'A' | 'B') => {
    const newParticipant: Participant = {
      id: `${group}-${Date.now()}`,
      name,
      stars: 0,
      eliminated: false,
    };
    if (group === 'A') {
      const newGroup = [...groupA, newParticipant];
      setGroupA(newGroup);
      updateParticipantsInDB(newGroup, groupB);
    } else {
      const newGroup = [...groupB, newParticipant];
      setGroupB(newGroup);
      updateParticipantsInDB(groupA, newGroup);
    }
  };

  const removeParticipant = (id: string, group: 'A' | 'B') => {
    if (group === 'A') {
      const newGroup = groupA.filter(p => p.id !== id);
      setGroupA(newGroup);
      updateParticipantsInDB(newGroup, groupB);
    } else {
      const newGroup = groupB.filter(p => p.id !== id);
      setGroupB(newGroup);
      updateParticipantsInDB(groupA, newGroup);
    }
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
        const json = utils.sheet_to_json<any>(worksheet, { header: 1 });
        
        if (json.length === 0) {
            throw new Error("A planilha está vazia.");
        }

        const header = json[0] as string[];
        const hasGroupColumns = header.includes('Grupo A') || header.includes('Grupo B');
        const jsonData = utils.sheet_to_json<any>(worksheet);

        const newGroupA: Participant[] = [];
        const newGroupB: Participant[] = [];

        if (hasGroupColumns) {
            jsonData.forEach((row, index) => {
                if (row['Grupo A']) {
                    newGroupA.push({
                    id: `A-${Date.now()}-${index}`,
                    name: String(row['Grupo A']),
                    stars: 0,
                    eliminated: false,
                    });
                }
                if (row['Grupo B']) {
                    newGroupB.push({
                    id: `B-${Date.now()}-${index}`,
                    name: String(row['Grupo B']),
                    stars: 0,
                    eliminated: false,
                    });
                }
            });
        } else {
            const allNames = jsonData.map(row => String(Object.values(row)[0])).filter(name => name.trim() !== '' && name.toLowerCase() !== header[0].toLowerCase());
            const midPoint = Math.ceil(allNames.length / 2);
            
            allNames.forEach((name, index) => {
                if (index < midPoint) {
                    newGroupA.push({
                        id: `A-${Date.now()}-${index}`,
                        name: name,
                        stars: 0,
                        eliminated: false,
                    });
                } else {
                    newGroupB.push({
                        id: `B-${Date.now()}-${index}`,
                        name: name,
                        stars: 0,
                        eliminated: false,
                    });
                }
            });
        }
        
        const updatedGroupA = [...groupA, ...newGroupA];
        const updatedGroupB = [...groupB, ...newGroupB];
        setGroupA(updatedGroupA);
        setGroupB(updatedGroupB);
        updateParticipantsInDB(updatedGroupA, updatedGroupB);


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

  const startDispute = async () => {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, 'participants'));
    if (!snapshot.exists() || (!snapshot.val().groupA?.length && !snapshot.val().groupB?.length)) {
        updateParticipantsInDB(groupA, groupB);
    }
    await set(ref(database, 'dispute'), {
        words: [],
        state: null,
    })
    router.push('/disputa');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <h2 className="text-2xl font-bold">Controles</h2>
            <AddParticipantForm onAddParticipant={addParticipant} />
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
                disabled={groupA.length === 0 || groupB.length === 0}
                onClick={startDispute}
               >
                 <Play className="mr-2 h-4 w-4" />
                 Iniciar Disputa
               </Button>
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ParticipantGroup title="Grupo A" participants={groupA} onRemove={id => removeParticipant(id, 'A')} />
            <ParticipantGroup title="Grupo B" participants={groupB} onRemove={id => removeParticipant(id, 'B')}/>
          </div>
        </div>
      </main>
    </div>
  );
}
