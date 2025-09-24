'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';

export default function RafflePage() {
  const [words, setWords] = useState<string[]>([]);
  const [participants, setParticipants] = useState<{ groupA: Participant[], groupB: Participant[] } | null>(null);

  useEffect(() => {
    const storedParticipants = localStorage.getItem('participants');
    if (storedParticipants) {
      setParticipants(JSON.parse(storedParticipants));
    }
    const storedWords = localStorage.getItem('words');
    if (storedWords) {
      setWords(JSON.parse(storedWords));
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold mb-6">Sorteio da Disputa</h2>
        <p>A tela de sorteio está em construção.</p>
        <p>Participantes e palavras foram carregados.</p>
      </main>
    </div>
  );
}
