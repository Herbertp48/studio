
      'use client';
      
      import { useState, useEffect, useRef } from 'react';
      import { useRouter } from 'next/navigation';
      import { AppHeader } from '@/components/app/header';
      import { Button } from '@/components/ui/button';
      import { Input } from '@/components/ui/input';
      import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
      import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
      import { List, Trash2, Play, Upload, Projector, PlusCircle, FileText, Users } from 'lucide-react';
      import type { Participant, ParticipantGroup } from '@/app/(app)/page';
      import { read, utils } from 'xlsx';
      import { useToast } from '@/hooks/use-toast';
      import { database } from '@/lib/firebase';
      import { ref, set, onValue, push, remove as removeDb, get, child } from 'firebase/database';
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
      import { Textarea } from '@/components/ui/textarea';
      import ProtectedRoute from '@/components/auth/ProtectedRoute';
      
      export type WordList = {
          id: string;
          name: string;
          words: string[];
      }
      
      function DisputePageContent() {
        const [wordLists, setWordLists] = useState<WordList[]>([]);
        const [participantGroups, setParticipantGroups] = useState<ParticipantGroup[]>([]);
        
        const [selectedListId, setSelectedListId] = useState<string | null>(null);
        const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
        
        const [newWord, setNewWord] = useState('');
        const [newListName, setNewListName] = useState('');
        const [massImportText, setMassImportText] = useState('');
        const [isMassImportDialogOpen, setIsMassImportDialogOpen] = useState(false);
        
        const fileInputRef = useRef<HTMLInputElement>(null);
        const { toast } = useToast();
        const router = useRouter();
      
        const selectedList = wordLists.find(list => list.id === selectedListId);
      
        useEffect(() => {
          const wordListsRef = ref(database, 'wordlists');
          const unsubscribeWords = onValue(wordListsRef, (snapshot) => {
             const data = snapshot.val();
             if (data) {
              const lists: WordList[] = Object.entries(data).map(([id, list]: [string, any]) => ({
                  id,
                  name: list.name,
                  words: list.words || [],
              }));
              setWordLists(lists);
             } else {
              setWordLists([]);
             }
          });
      
          const participantGroupsRef = ref(database, 'participant-groups');
          const unsubscribeGroups = onValue(participantGroupsRef, (snapshot) => {
             const data = snapshot.val();
             if (data) {
              const groups: ParticipantGroup[] = Object.entries(data).map(([id, group]: [string, any]) => ({
                  id,
                  name: group.name,
                  participants: group.participants || {},
              }));
              setParticipantGroups(groups);
             } else {
              setParticipantGroups([]);
             }
          });
      
          return () => {
              unsubscribeWords();
              unsubscribeGroups();
          };
        }, []);
        
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
                  const updatedWords = Array.from(new Set([...(selectedList.words || []), ...newWords]));
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
      
        const handleMassImport = async () => {
          if (!massImportText.trim()) {
              toast({ variant: 'destructive', title: 'Erro', description: 'O campo de texto está vazio.'});
              return;
          }
      
          try {
              const wordListsRef = ref(database, 'wordlists');
              const snapshot = await get(wordListsRef);
              const existingLists: WordList[] = snapshot.exists() 
                  ? Object.entries(snapshot.val()).map(([id, list]: [string, any]) => ({ id, ...list }))
                  : [];
      
              const groups = massImportText.split(/--{10,}/);
              const newLists: { [key: string]: string[] } = {};
      
              for (const group of groups) {
                  if (!group.trim()) continue;
                  
                  const lines = group.trim().split('\n');
                  const firstLine = lines[0];
                  const match = firstLine.match(/^(.+?):/);
                  
                  if (!match) continue;
      
                  const listName = match[1].trim();
                  const wordsContent = group.substring(match[0].length);
                  const words = wordsContent.split(' - ')
                                            .map(w => w.trim().replace(/\n/g, ' '))
                                            .filter(w => w.length > 0);
      
                  if (!newLists[listName]) {
                      newLists[listName] = [];
                  }
                  newLists[listName].push(...words);
              }
              
              for (const listName in newLists) {
                  const uniqueWords = Array.from(new Set(newLists[listName]));
                  const existingList = existingLists.find(l => l.name === listName);
      
                  if (existingList) {
                      const updatedWords = Array.from(new Set([...(existingList.words || []), ...uniqueWords]));
                      updateWordsInDB(existingList.id, updatedWords);
                  } else {
                      const newListRef = push(wordListsRef);
                      set(newListRef, { name: listName, words: uniqueWords });
                  }
              }
              
              toast({ title: 'Sucesso!', description: 'Listas de palavras importadas e atualizadas.'});
              setMassImportText('');
              setIsMassImportDialogOpen(false);
      
          } catch (error) {
              console.error("Erro na importação em massa:", error);
              toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao importar as listas.'});
          }
      };
      
        
        const openProjection = () => {
          window.open('/projetor', '_blank', 'width=1920,height=1080');
        }
      
        const startRaffle = () => {
          const selectedGroup = participantGroups.find(g => g.id === selectedGroupId);
          if (!selectedGroup) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um grupo de participantes.' });
            return;
          }
        
          const activeParticipants = Object.values(selectedGroup.participants || {}).filter(p => !p.eliminated);
          
          if (!selectedList) {
              toast({ variant: 'destructive', title: 'Erro', description: 'Selecione uma lista de palavras.' });
              return;
          }
          if (selectedList.words.length === 0) {
              toast({ variant: 'destructive', title: 'Erro', description: 'A lista de palavras selecionada está vazia.' });
              return;
          }
          if (activeParticipants.length < 2) {
              toast({ variant: 'destructive', title: 'Erro', description: 'São necessários pelo menos 2 participantes ativos no grupo selecionado.' });
              return;
          }
          
          const participantsForDispute = activeParticipants.reduce((acc, p) => {
            acc[p.id] = { ...p, stars: 0 };
            return acc;
          }, {} as { [key: string]: Participant });
        
          set(ref(database, 'dispute'), {
            words: selectedList.words,
            participants: participantsForDispute,
          });
          router.push('/sorteio');
        };
      
        return (
          <div className="flex flex-col w-full bg-background text-foreground">
            <AppHeader />
            <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <h2 className="text-2xl font-bold mb-6">Gerenciar Disputa</h2>
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
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload}
                            className="hidden" 
                            accept=".xlsx, .xls"
                          />
                         <Button variant="outline" className="w-full" onClick={triggerFileUpload}>
                           <Upload className="mr-2 h-4 w-4" />
                           Importar Excel
                         </Button>
                          <Dialog open={isMassImportDialogOpen} onOpenChange={setIsMassImportDialogOpen}>
                            <DialogTrigger asChild>
                               <Button variant="outline" className="w-full">
                                  <FileText className="mr-2 h-4 w-4" />
                                  Importar Texto
                               </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                              <DialogHeader>
                                <DialogTitle>Importação em Massa</DialogTitle>
                                <DialogDescription>
                                  Cole o conteúdo do seu arquivo (.doc, .txt, etc.) abaixo. O sistema irá separar as listas e palavras automaticamente.
                                  O formato esperado é "Nome da Lista: PALAVRA1 - PALAVRA2" e as listas separadas por "----------".
                                </DialogDescription>
                              </DialogHeader>
                              <Textarea 
                                  placeholder="Ex: 2° ano: HELLO - WORLD..."
                                  className="min-h-[250px] mt-4"
                                  value={massImportText}
                                  onChange={(e) => setMassImportText(e.target.value)}
                              />
                              <DialogFooter>
                                  <DialogClose asChild>
                                      <Button type="button" variant="secondary">Cancelar</Button>
                                  </DialogClose>
                                  <Button onClick={handleMassImport} disabled={!massImportText.trim()}>Importar Listas</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
      
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
                <div className="space-y-8">
                  <Card>
                      <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Users/> Grupo de Participantes</CardTitle>
                          <CardDescription>Selecione qual grupo irá participar desta disputa.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <Select onValueChange={setSelectedGroupId} value={selectedGroupId || ''}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Selecione um grupo" />
                              </SelectTrigger>
                              <SelectContent>
                                  {participantGroups.map(group => (
                                      <SelectItem key={group.id} value={group.id}>{group.name} ({Object.keys(group.participants || {}).length} participantes)</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </CardContent>
                  </Card>
                  <div className="flex flex-col gap-2">
                      <Button variant="outline" onClick={openProjection}>
                        <Projector className="mr-2" />
                        Abrir Tela de Projeção
                      </Button>
                      <Button 
                          className="w-full" 
                          size="lg" 
                          onClick={startRaffle}
                          disabled={!selectedListId || !selectedGroupId}
                          >
                          <Play className="mr-2" />
                          Iniciar Sorteio
                      </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      export default function DisputePage() {
          return (
              <ProtectedRoute page="disputa">
                  <DisputePageContent />
              </ProtectedRoute>
          )
      }
      
    