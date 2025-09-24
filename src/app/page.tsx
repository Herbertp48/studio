'use client';

import { useState, useRef } from 'react';
import { AppHeader } from '@/components/app/header';
import { ParticipantGroup } from '@/components/app/participant-group';
import { AddParticipantForm } from '@/components/app/add-participant-form';
import { Button } from '@/components/ui/button';
import { Upload, Play } from 'lucide-react';
import { read, utils, WorkSheet } from 'xlsx';
import { useToast } from '@/hooks/use-toast';

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

  const addParticipant = (name: string, group: 'A' | 'B') => {
    const newParticipant: Participant = {
      id: `${group}-${Date.now()}`,
      name,
      stars: 0,
      eliminated: false,
    };
    if (group === 'A') {
      setGroupA(prev => [...prev, newParticipant]);
    } else {
      setGroupB(prev => [...prev, newParticipant]);
    }
  };

  const removeParticipant = (id: string, group: 'A' | 'B') => {
    if (group === 'A') {
      setGroupA(prev => prev.filter(p => p.id !== id));
    } else {
      setGroupB(prev => prev.filter(p => p.id !== id));
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
        const json = utils.sheet_to_json<any>(worksheet);

        const newGroupA: Participant[] = [];
        const newGroupB: Participant[] = [];

        json.forEach((row, index) => {
          if (row['Grupo A']) {
            newGroupA.push({
              id: `A-${Date.now()}-${index}`,
              name: row['Grupo A'],
              stars: 0,
              eliminated: false,
            });
          }
          if (row['Grupo B']) {
            newGroupB.push({
              id: `B-${Date.now()}-${index}`,
              name: row['Grupo B'],
              stars: 0,
              eliminated: false,
            });
          }
        });

        setGroupA(prev => [...prev, ...newGroupA]);
        setGroupB(prev => [...prev, ...newGroupB]);

        toast({
          title: 'Sucesso!',
          description: 'Participantes importados com sucesso.',
        });

      } catch (error) {
        console.error("Erro ao importar arquivo:", error);
        toast({
          variant: "destructive",
          title: 'Erro de Importação',
          description: 'Não foi possível ler o arquivo. Verifique o formato e tente novamente.',
        });
      } finally {
        // Limpa o valor do input para permitir o upload do mesmo arquivo novamente
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
               <Button className="w-full" disabled>
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
