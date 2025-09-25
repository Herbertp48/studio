'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw, PartyPopper, Projector, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { database } from '@/lib/firebase';
import { ref, set, onValue, update, push, get } from 'firebase/database';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export type WordList = {
    id: string;
    name: string;
    words: string[];
}

type RaffleState = 'idle' | 'participants_sorted' | 'word_preview' | 'word_sorted' | 'round_finished' | 'shuffling';
type SortMode = 'random' | 'sequential';
type DisputeState = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'ROUND_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS';
    participantA?: Participant | null;
    participantB?: Participant | null;
    word?: string | null;
    winner?: Participant | null;
    loser?: Participant | null;
    finalWinner?: Participant | null;
    activeParticipants?: Participant[];
}

const setDisputeState = (state: DisputeState | null) => {
    set(ref(database, 'dispute/state'), state);
}

function RafflePageContent() {
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  
  const [currentDuel, setCurrentDuel] = useState<{ participantA: Participant, participantB: Participant } | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [raffleState, setRaffleState] = useState<RaffleState>('idle');
  const [roundWinner, setRoundWinner] = useState<Participant | null>(null);
  const [showFinalWinnerDialog, setShowFinalWinnerDialog] = useState(false);
  const [finalWinner, setFinalWinner] = useState<Participant | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('random');
  const [manualReveal, setManualReveal] = useState(false);
  const [originalWords, setOriginalWords] = useState<string[]>([]);

  const { toast } = useToast();
  const router = useRouter();


  useEffect(() => {
    const disputeRef = ref(database, 'dispute');
    let initialLoad = true;

    const unsubscribe = onValue(disputeRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.participants && data.words) {
            const participantsArray = Array.isArray(data.participants) 
                ? data.participants 
                : Object.values(data.participants);
            setParticipants(participantsArray);
            
            if (initialLoad) {
                setAvailableWords(data.words);
                setOriginalWords(data.words);
                initialLoad = false;
            }

            if (raffleState === 'round_finished' || raffleState === 'idle') {
                checkForWinner(participantsArray);
            }
        } else {
            toast({ variant: "destructive", title: "Erro", description: "Dados da disputa não encontrados."});
            router.push('/disputa');
        }
    });
    
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

    setDisputeState({ type: 'RESET' });

    return () => {
        unsubscribe();
        unsubscribeWords();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const checkForWinner = (currentParticipants: Participant[]) => {
    if (!currentParticipants || finalWinner) return;
    
    const activeParticipants = currentParticipants.filter(p => !p.eliminated);
    
    if (activeParticipants.length === 1) {
        const winner = activeParticipants[0];
        setFinalWinner(winner);
        setShowFinalWinnerDialog(true);
        setDisputeState({ type: 'FINAL_WINNER', finalWinner: winner });
    } else if (activeParticipants.length < 2 && currentParticipants.length > 0) {
        const winner = currentParticipants.filter(p => !p.eliminated).sort((a,b) => b.stars - a.stars)[0];
         if (winner) {
            setFinalWinner(winner);
            setShowFinalWinnerDialog(true);
            setDisputeState({ type: 'FINAL_WINner', finalWinner: winner });
         }
    }
  }

  const sortParticipants = () => {
    if (!participants) return;
    
    setRoundWinner(null);
    setCurrentWord(null);
    setDisputeState({ type: 'RESET' });

    let activeParticipants = participants.filter(p => !p.eliminated);

    if (activeParticipants.length < 2) {
      checkForWinner(participants);
      if(!finalWinner) {
        toast({ variant: "destructive", title: "Sorteio Inválido", description: "É preciso ter pelo menos 2 participantes ativos." });
      }
      return;
    }

    setRaffleState('shuffling');
    setDisputeState({ type: 'SHUFFLING_PARTICIPANTS', activeParticipants });
    
    setTimeout(() => {
        const shuffled = activeParticipants.sort(() => 0.5 - Math.random());
        const participantA = shuffled[0];
        const participantB = shuffled[1];

        setCurrentDuel({ participantA, participantB });
        setRaffleState('participants_sorted');
        setDisputeState({ type: 'UPDATE_PARTICIPANTS', participantA, participantB });
    }, 4000); // Animation duration
  };

  const sortWord = () => {
    let currentAvailableWords = [...availableWords];
    if (currentAvailableWords.length === 0) {
      toast({ title: "Aviso", description: "Todas as palavras já foram sorteadas. Reiniciando a lista de palavras." });
      setAvailableWords(originalWords);
      currentAvailableWords = originalWords;
    }
     if (currentAvailableWords.length === 0) {
        toast({ variant: "destructive", title: "Erro", description: "Nenhuma palavra disponível para sorteio." });
        return;
    }

    let sortedWord: string;
    let wordIndex: number;

    if (sortMode === 'sequential') {
      wordIndex = 0;
      sortedWord = currentAvailableWords[wordIndex];
    } else {
      wordIndex = Math.floor(Math.random() * currentAvailableWords.length);
      sortedWord = currentAvailableWords[wordIndex];
    }
    
    setCurrentWord(sortedWord);
    setAvailableWords(prev => prev.filter((_, i) => i !== prev.indexOf(sortedWord)));
    
    if (manualReveal) {
        setRaffleState('word_preview');
    } else {
        setRaffleState('word_sorted');
        setDisputeState({ type: 'SHOW_WORD', word: sortedWord, participantA: currentDuel?.participantA, participantB: currentDuel?.participantB });
    }
  };

  const revealWord = () => {
    if (!currentWord || !currentDuel) return;
    setRaffleState('word_sorted');
    setDisputeState({ type: 'SHOW_WORD', word: currentWord, participantA: currentDuel.participantA, participantB: currentDuel.participantB });
  };
  
  const handleWinner = async (winnerId: string) => {
    if (!currentDuel || !currentWord) return;

    let winner = participants.find(p => p.id === winnerId);
    const loser = participants.find(p => p.id === (currentDuel.participantA.id === winnerId ? currentDuel.participantB.id : currentDuel.participantA.id));

    if (!winner || !loser) {
      toast({ variant: "destructive", title: "Erro", description: "Participante não encontrado." });
      return;
    }

    const newWinnerEntryRef = push(ref(database, 'winners'));
    await set(newWinnerEntryRef, {
      name: winner.name,
      word: currentWord,
      stars: 1 
    });

    const updates: any = {};
    const newStars = (winner.stars || 0) + 1;

    const winnerUpdate = { ...winner, stars: newStars };
    const loserUpdate = { ...loser, eliminated: true };

    updates[`dispute/participants/${winner.id}`] = winnerUpdate;
    updates[`dispute/participants/${loser.id}`] = loserUpdate;

    await update(ref(database), updates);

    setRoundWinner(winnerUpdate);
    setDisputeState({ type: 'ROUND_WINNER', winner: winnerUpdate, loser: loserUpdate, word: currentWord });
    toast({
      title: "Disputa Encerrada!",
      description: `${winner.name} venceu a rodada e ganhou uma estrela!`,
    });
    
    setRaffleState('round_finished');
  };
  
  const nextRound = () => {
    setCurrentDuel(null);
    setCurrentWord(null);
    setRoundWinner(null);
    setRaffleState('idle');
    setDisputeState({ type: 'RESET' });
    if(participants) checkForWinner(participants);
  }
  
  const openProjection = () => {
    window.open('/projetor', '_blank', 'width=1920,height=1080');
  }

  const handleWordListChange = (listId: string) => {
    const selectedList = wordLists.find(list => list.id === listId);
    if (selectedList) {
        const newWords = selectedList.words || [];
        setAvailableWords(newWords);
        setOriginalWords(newWords);
        set(ref(database, 'dispute/words'), newWords);
        toast({ title: 'Lista Alterada!', description: `Agora usando a lista "${selectedList.name}".`});
    }
  };

  const renderState = () => {
    if (!participants) {
      return <p className="text-center text-muted-foreground">Carregando...</p>;
    }
    
    const activeParticipantsCount = participants.filter(p => !p.eliminated).length;

    if (raffleState === 'shuffling') {
      return (
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl font-bold">Embaralhando...</h2>
          <p className="text-lg text-muted-foreground">Aguarde, os participantes estão sendo sorteados.</p>
          <Dices className="animate-spin h-10 w-10 text-primary" />
        </div>
      );
    }
    
    if (raffleState === 'idle') {
      return (
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl font-bold">Próxima Rodada</h2>
          <div className="text-lg text-muted-foreground">
            <p>{activeParticipantsCount} participantes ativos</p>
          </div>
          <Button size="lg" onClick={sortParticipants} disabled={finalWinner != null || activeParticipantsCount < 2}>
            <Dices className="mr-2"/>Sortear Participantes
          </Button>
          {activeParticipantsCount < 2 && participants.length > 0 && !finalWinner && (
             <p className="text-amber-600 mt-4">Não há participantes ativos suficientes para uma disputa.</p>
          )}
        </div>
      )
    }

    if (raffleState === 'participants_sorted' && currentDuel) {
      return (
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-primary">Disputa Definida!</h2>
          <div className="flex items-center justify-center gap-4 text-2xl font-semibold">
              <div className="flex items-center gap-2">
                <Trophy className="text-amber-400" />
                <span>{currentDuel.participantA.name}</span>
              </div>
              <span className="text-muted-foreground">vs.</span>
              <div className="flex items-center gap-2">
                <span>{currentDuel.participantB.name}</span>
                <Trophy className="text-amber-400" />
              </div>
          </div>
          <Button size="lg" onClick={sortWord} className="mt-4">
            <PartyPopper className="mr-2"/>Sortear Palavra
          </Button>
        </div>
      )
    }

    if (raffleState === 'word_preview' && currentWord) {
       return (
         <div className="text-center flex flex-col items-center gap-6">
            <p className="text-lg text-muted-foreground">Palavra sorteada (apenas para você):</p>
            <p className="text-5xl font-bold tracking-widest uppercase text-primary">{currentWord}</p>
            <Button size="lg" onClick={revealWord} className="mt-4 bg-amber-500 hover:bg-amber-600">
                <Eye className="mr-2"/>Revelar no Projetor
            </Button>
        </div>
       )
    }
    
    if (raffleState === 'word_sorted' && currentDuel && currentWord) {
      return (
        <div className="text-center flex flex-col items-center gap-6">
            <p className="text-lg text-muted-foreground">A palavra é:</p>
            <p className="text-5xl font-bold tracking-widest uppercase text-primary">{currentWord}</p>
            <p className="text-xl font-semibold mt-4">Quem venceu a disputa?</p>
            <div className="flex justify-center gap-4">
                <Button variant="outline" size="lg" onClick={() => handleWinner(currentDuel.participantA.id)}>
                    <Star className="mr-2"/> {currentDuel.participantA.name}
                </Button>
                <Button variant="outline" size="lg" onClick={() => handleWinner(currentDuel.participantB.id)}>
                    <Star className="mr-2"/> {currentDuel.participantB.name}
                </Button>
            </div>
        </div>
      )
    }

    if (raffleState === 'round_finished' && roundWinner) {
      return (
        <div className="text-center flex flex-col items-center gap-6">
            <h2 className="text-3xl font-bold">{roundWinner.name} venceu!</h2>
            <p className="text-xl text-amber-500 flex items-center justify-center gap-2">
                <Star /> Ganhou 1 estrela!
            </p>
            <p className="text-muted-foreground">{activeParticipantsCount} participantes restantes</p>
            <Button size="lg" onClick={nextRound} disabled={finalWinner != null}><RefreshCw className="mr-2" />Próxima Rodada</Button>
        </div>
      )
    }
    
    return null;
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center">
        <Card className="w-full max-w-2xl shadow-xl">
             <CardHeader>
                <CardTitle>Configuração do Sorteio</CardTitle>
                <CardDescription>Ajuste as opções para a disputa atual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center justify-between">
                    <Label className="flex-shrink-0 mr-4">Modo de Sorteio de Palavras:</Label>
                    <RadioGroup 
                        defaultValue="random" 
                        onValueChange={(value: SortMode) => setSortMode(value)}
                        className="flex items-center gap-4"
                        disabled={raffleState !== 'idle'}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="random" id="r-random" />
                            <Label htmlFor="r-random">Aleatório</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sequential" id="r-sequential" />
                            <Label htmlFor="r-sequential">Sequencial</Label>
                        </div>
                    </RadioGroup>
                 </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="manual-reveal-switch">Revelação Manual:</Label>
                    <Switch
                        id="manual-reveal-switch"
                        checked={manualReveal}
                        onCheckedChange={setManualReveal}
                        disabled={raffleState !== 'idle'}
                    />
                </div>
                <div className="flex flex-col space-y-2">
                    <Label>Alterar Lista de Palavras em Jogo:</Label>
                    <Select onValueChange={handleWordListChange} disabled={wordLists.length === 0 || raffleState !== 'idle'}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione uma lista para alterar" />
                        </SelectTrigger>
                        <SelectContent>
                            {wordLists.map(list => (
                                <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
        
        <Card className="w-full max-w-2xl min-h-[22rem] flex items-center justify-center shadow-2xl mt-8">
            <CardContent className="pt-10 w-full">
                {renderState()}
            </CardContent>
        </Card>
        
        <div className="mt-8">
            <Button variant="outline" onClick={openProjection}>
                <Projector className="mr-2" />
                Abrir Tela de Projeção
            </Button>
        </div>

        <AlertDialog open={showFinalWinnerDialog} onOpenChange={setShowFinalWinnerDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle className="text-center text-3xl font-bold">A disputa acabou!</AlertDialogTitle>
                <AlertDialogDescription className="text-center text-lg" asChild>
                    <div className="flex flex-col items-center justify-center gap-4 py-6">
                        <Crown className="w-20 h-20 text-yellow-400" />
                        <p className="text-2xl font-bold mt-2">O grande vencedor é</p>
                        <p className="text-4xl font-bold text-foreground">{finalWinner?.name}</p>
                         <p className="flex items-center gap-2 text-yellow-500 font-bold text-lg">
                            <Star className="w-6 h-6" /> {`x${finalWinner?.stars || 0}`}
                        </p>
                    </div>
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction className="w-full" onClick={() => router.push('/')}>Voltar para o Início</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

export default function RafflePage() {
    return (
        <ProtectedRoute page="sorteio">
            <RafflePageContent />
        </ProtectedRoute>
    )
}
