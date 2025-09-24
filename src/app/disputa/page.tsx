'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { List, Trash2, Play } from 'lucide-react';
import type { Participant } from '@/app/page';

export default function DisputePage() {
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [participants, setParticipants] = useState<{ groupA: Participant[], groupB: Participant[] } | null>(null);

  useEffect(() => {
    const storedParticipants = localStorage.getItem('participants');
    if (storedParticipants) {
      setParticipants(JSON.parse(storedParticipants));
    }
  }, []);

  const addWord = () => {
    if (newWord.trim()) {
      setWords(prev => [...prev, newWord.trim()]);
      setNewWord('');
    }
  };

  const removeWord = (index: number) => {
    setWords(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold mb-6">Gerenciar Palavras</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><List /> Lista de Palavras</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input 
                    placeholder="Digite uma nova palavra"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addWord()}
                  />
                  <Button onClick={addWord}>Adicionar</Button>
                </div>
                <ul className="space-y-2 max-h-80 overflow-y-auto">
                  {words.length > 0 ? words.map((word, index) => (
                    <li key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span>{word}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeWord(index)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </li>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma palavra adicionada.</p>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
             <Card>
                <CardHeader><CardTitle>Participantes</CardTitle></CardHeader>
                <CardContent>
                    {participants ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-bold mb-2">Grupo A</h3>
                                <ul className="text-sm text-muted-foreground">
                                    {participants.groupA.map(p => <li key={p.id}>{p.name}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-bold mb-2">Grupo B</h3>
                                <ul className="text-sm text-muted-foreground">
                                    {participants.groupB.map(p => <li key={p.id}>{p.name}</li>)}
                                </ul>
                            </div>
                        </div>
                    ) : <p>Carregando participantes...</p>}
                </CardContent>
            </Card>
            <Button className="w-full" size="lg" disabled={words.length === 0 || !participants}>
              <Play className="mr-2" />
              Começar Sorteio
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
