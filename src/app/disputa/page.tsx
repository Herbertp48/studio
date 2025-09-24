'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { List, Trash2, Play, Upload } from 'lucide-react';
import type { Participant } from '@/app/page';
import { read, utils } from 'xlsx';
import { useToast } from '@/hooks/use-toast';

export default function DisputePage() {
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [participants, setParticipants] = useState<{ groupA: Participant[], groupB: Participant[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

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

        const newWords = json
          .map(row => String(row[0]).trim())
          .filter(word => word && word.length > 0);

        setWords(prev => [...prev, ...newWords]);

        toast({
          title: 'Sucesso!',
          description: 'Palavras importadas com sucesso.',
        });

      } catch (error) {
        console.error("Erro ao importar arquivo de palavras:", error);
        toast({
          variant: "destructive",
          title: 'Erro de Importação',
          description: 'Não foi possível ler o arquivo. Verifique se a primeira coluna contém as palavras.',
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

  const startRaffle = () => {
    localStorage.setItem('words', JSON.stringify(words));
    router.push('/sorteio');
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
                 <div className="space-y-4 mb-4">
                   <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload}
                      className="hidden" 
                      accept=".xlsx, .xls"
                    />
                   <Button variant="outline" className="w-full" onClick={triggerFileUpload}>
                     <Upload className="mr-2 h-4 w-4" />
                     Importar Palavras do Excel
                   </Button>
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
            <Button 
              className="w-full" 
              size="lg" 
              disabled={words.length === 0 || !participants}
              onClick={startRaffle}
            >
              <Play className="mr-2" />
              Começar Sorteio
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
