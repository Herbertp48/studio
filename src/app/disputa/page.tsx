'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, Trash2, Play, Upload, Projector, PlusCircle } from 'lucide-react';
import type { Participant } from '@/app/page';
import { read, utils } from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, set, onValue, push, remove as removeDb } from 'firebase/database';
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


export type WordList = {
    id: string;
    name: string;
    words: string[];
}

export default function DisputePage() {
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newWord, setNewWord] = useState('');
  const [newListName, setNewListName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const selectedList = wordLists.find(list => list.id === selectedListId);

  useEffect(() => {
    const wordListsRef = ref(database, 'wordlists');
    const unsubscribe = onValue(wordListsRef, (snapshot) => {
       const data = snapshot.val();
       if (data) {
        const lists: WordList[] = Object.entries(data).map(([id, list]: [string, any]) => ({
            id,
            name: list.name,
            words: list.words || [],
        }));
        setWordLists(lists);
        if (!selectedListId && lists.length > 0) {
            setSelectedListId(lists[0].id);
        }
       } else {
        setWordLists([]);
        setSelectedListId(null);
       }
    });

    return () => unsubscribe();
  }, [selectedListId]);
  
  const handleCreateList = () => {
    if (!newListName.trim()) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O nome da lista não pode estar vazio.'});
        return;
    }
    const newListRef = push(ref(database, 'wordlists'));
    set(newListRef, { name: newListName.trim(), words: [] });
    setNewListName('');
    toast({ title: 'Sucesso!', description: `A lista "${newListName.trim()}" foi criada.`});
  }

  const handleDeleteList = (listId: string) => {
    removeDb(ref(database, `wordlists/${listId}`));
    toast({ title: 'Sucesso!', description: 'A lista foi removida.'});
    if (selectedListId === listId) {
        setSelectedListId(null);
    }
  }

  const updateWordsInDB = (listId: string, newWords: string[]) => {
    set(ref(database, `wordlists/${listId}/words`), newWords);
  };

  const addWord = () => {
    if (newWord.trim() && selectedList) {
      const newWords = [...(selectedList.words || []), newWord.trim()];
      updateWordsInDB(selectedList.id, newWords);
      setNewWord('');
    }
  };

  const removeWord = (index: number) => {
    if (selectedList) {
        const newWords = selectedList.words.filter((_, i) => i !== index);
        updateWordsInDB(selectedList.id, newWords);
    }
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedListId) {
      toast({ variant: "destructive", title: 'Nenhuma lista selecionada', description: 'Selecione uma lista antes de importar palavras.' });
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
        
        if (json.length === 0) {
            throw new Error("A planilha está vazia.");
        }

        const newWords = json
          .map(row => String(row[0]).trim())
          .filter(word => word && word.length > 0);
        
        if (selectedList) {
            const updatedWords = [...(selectedList.words || []), ...newWords];
            updateWordsInDB(selectedList.id, updatedWords);
        }

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
  
  const openProjection = () => {
    window.open('/projetor', '_blank', 'width=1920,height=1080');
  }

  const startRaffle = () => {
    const activeParticipantsRef = ref(database, 'participants/all');
    onValue(activeParticipantsRef, (snapshot) => {
        const participants = snapshot.val();
        const activeParticipants = participants?.filter((p: Participant) => !p.eliminated) || [];
        if (!selectedList || selectedList.words.length === 0) {
            toast({ variant: 'destructive', title: 'Erro', description: 'A lista de palavras selecionada está vazia.' });
            return;
        }
        if (activeParticipants.length < 2) {
            toast({ variant: 'destructive', title: 'Erro', description: 'São necessários pelo menos 2 participantes ativos.' });
            return;
        }
        // Save selected list to be used in raffle
        set(ref(database, 'dispute'), {
            words: selectedList.words,
        });
        router.push('/sorteio');
    }, { onlyOnce: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold mb-6">Gerenciar Listas de Palavras</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><List /> Lista de Palavras</div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="outline" size="sm"><PlusCircle className="mr-2" /> Nova Lista</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Criar Nova Lista de Palavras</AlertDialogTitle>
                          <AlertDialogDescription>
                            <Input 
                                placeholder="Nome da nova lista"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                className="mt-4"
                            />
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCreateList} disabled={!newListName.trim()}>Criar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </CardTitle>
                <CardDescription>Selecione, crie e gerencie suas listas de palavras.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                    <Select onValueChange={setSelectedListId} value={selectedListId || ''}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione uma lista" />
                        </SelectTrigger>
                        <SelectContent>
                            {wordLists.map(list => (
                                <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedListId && (
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon"><Trash2 /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Essa ação não pode ser desfeita. A lista "{selectedList?.name}" e todas as suas palavras serão removidas.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteList(selectedListId)}>Apagar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>

                {selectedListId ? (
                <>
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
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedList && selectedList.words && selectedList.words.length > 0 ? selectedList.words.map((word, index) => (
                    <li key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span>{word}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeWord(index)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </li>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma palavra nesta lista.</p>
                  )}
                </ul>
                </>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-10">
                        {wordLists.length > 0 ? 'Selecione uma lista para começar.' : 'Crie uma nova lista para adicionar palavras.'}
                    </p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 pt-8">
                <Button variant="outline" onClick={openProjection}>
                  <Projector className="mr-2" />
                  Abrir Tela de Projeção
                </Button>
                <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={startRaffle}
                    disabled={!selectedListId}
                    >
                    <Play className="mr-2" />
                    Ir para o Sorteio
                </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
