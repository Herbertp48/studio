'use client';

import { useState } from 'react';
import { AppHeader } from '@/components/app/header';
import { ParticipantGroup } from '@/components/app/participant-group';
import { AddParticipantForm } from '@/components/app/add-participant-form';
import { Button } from '@/components/ui/button';
import { Upload, Play } from 'lucide-react';

export type Participant = {
  id: string;
  name: string;
  stars: number;
  eliminated: boolean;
};

export default function Home() {
  const [groupA, setGroupA] = useState<Participant[]>([]);
  const [groupB, setGroupB] = useState<Participant[]>([]);

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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <h2 className="text-2xl font-bold">Controles</h2>
            <AddParticipantForm onAddParticipant={addParticipant} />
             <div className="space-y-4">
               <Button variant="outline" className="w-full">
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
