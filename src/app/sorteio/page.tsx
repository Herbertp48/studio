'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import type { WordList } from '@/app/disputa/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw, PartyPopper, Projector } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { ref, set, onValue, update } from 'firebase/database';


type RaffleState = 'idle' | 'participants_sorted' | 'word_sorted' | 'round_finished' | 'shuffling';
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

export default function RafflePage() {
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const [currentDuel, setCurrentDuel] = useState<{ participantA: Participant, participantB: Participant } | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [raffleState, setRaffleState] = useState<RaffleState>('idle');
  const [roundWinner, setRoundWinner] = useState<Participant | null>(null);
  const [showFinalWinnerDialog, setShowFinalWinnerDialog] = useState(false);
  const [finalWinner, setFinalWinner] = useState<Participant | null>(null);

  const { toast } = useToast();
  const router = useRouter();

  const selectedList = wordLists.find(list => list.id === selectedListId);

  useEffect(() => {
    const participantsRef = ref(database, 'participants/all');
    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setParticipants(data);
            if (raffleState === 'round_finished' || raffleState === 'idle') {
                checkForWinner(data);
            }
        } else {
            toast({ variant: "destructive", title: "Erro", description: "Participantes não encontrados."});
            router.push('/');
        }
    });

    const wordListsRef = ref(database, 'wordlists');
    const unsubscribeWordLists = onValue(wordListsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const lists: WordList[] = Object.entries(data).map(([id, list]: [string, any]) => ({
                id,
                name: list.name,
                words: list.words || [],
            }));
            setWordLists(lists);
        } else {
             toast({ variant: "destructive", title: "Erro", description: "Nenhuma lista de palavras encontrada."});
             router.push('/disputa');
        }
    });
    
    setDisputeState({ type: 'RESET' });

    return () => {
        unsubscribeParticipants();
        unsubscribeWordLists();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedList) {
      setAvailableWords(selectedList.words || []);
    }
  }, [selectedListId, wordLists, selectedList]);
  
  const checkForWinner = (currentParticipants: Participant[]) => {
    if (!currentParticipants || finalWinner) return;
    
    const activeParticipants = currentParticipants.filter(p => !p.eliminated);
    
    if (activeParticipants.length === 1) {
        const winner = activeParticipants[0];
        setFinalWinner(winner);
        setShowFinalWinnerDialog(true);
        setDisputeState({ type: 'FINAL_WINNER', finalWinner: winner });
    } else if (activeParticipants.length < 2 && currentParticipants.length > 0) {
        // This case handles a tie or if all are eliminated at once
        const winner = currentParticipants.filter(p => !p.eliminated).sort((a,b) => b.stars - a.stars)[0];
         if (winner) {
            setFinalWinner(winner);
            setShowFinalWinnerDialog(true);
            setDisputeState({ type: 'FINAL_WINNER', finalWinner: winner });
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
    let currentAvailableWords = availableWords;
    if (currentAvailableWords.length === 0 && selectedList) {
      toast({ title: "Aviso", description: "Todas as palavras já foram sorteadas. Reiniciando a lista de palavras." });
      setAvailableWords(selectedList.words);
      currentAvailableWords = selectedList.words;
    }
     if (currentAvailableWords.length === 0) {
        toast({ variant: "destructive", title: "Erro", description: "Nenhuma palavra disponível para sorteio." });
        return;
    }

    const wordIndex = Math.floor(Math.random() * currentAvailableWords.length);
    const sortedWord = currentAvailableWords[wordIndex];
    
    setCurrentWord(sortedWord);
    setAvailableWords(prev => prev.filter((_, i) => i !== wordIndex));
    setRaffleState('word_sorted');
    setDisputeState({ type: 'SHOW_WORD', word: sortedWord, participantA: currentDuel?.participantA, participantB: currentDuel?.participantB });
  };
  
  const handleWinner = async (winnerId: string) => {
    if (!currentDuel || !currentWord || !participants) return;

    const winnerIsA = currentDuel.participantA.id === winnerId;
    let winner = winnerIsA ? currentDuel.participantA : currentDuel.participantB;
    const loser = winnerIsA ? currentDuel.participantB : currentDuel.participantA;
    
    const winnerInDb = participants.find(p => p.id === winner.id);
    const loserInDb = participants.find(p => p.id === loser.id);

    if (!winnerInDb || !loserInDb) {
      toast({ variant: "destructive", title: "Erro", description: "Participante não encontrado para atualização." });
      return;
    }
    
    const updates: any = {};
    const newStars = (winnerInDb.stars || 0) + 1;
    
    updates[`participants/all/${participants.findIndex(p => p.id === winner.id)}/stars`] = newStars;
    updates[`participants/all/${participants.findIndex(p => p.id === loser.id)}/eliminated`] = true;
    
    await update(ref(database), updates);
    
    const updatedParticipants = [...participants];
    const winnerIndex = updatedParticipants.findIndex(p => p.id === winner.id);
    const loserIndex = updatedParticipants.findIndex(p => p.id === loser.id);
    
    winner = { ...winner, stars: newStars };
    updatedParticipants[winnerIndex] = winner;
    updatedParticipants[loserIndex] = { ...loser, eliminated: true };

    setParticipants(updatedParticipants);
    setRoundWinner(winner);

    setDisputeState({ type: 'ROUND_WINNER', winner, loser, word: currentWord });
    toast({
      title: "Disputa Encerrada!",
      description: `${winner.name} venceu a rodada e ganhou uma estrela!`,
    });
    
    setRaffleState('round_finished');
    
    setTimeout(() => {
        checkForWinner(updatedParticipants);
    }, 500);
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
          <Button size="lg" onClick={sortParticipants} disabled={finalWinner != null || activeParticipantsCount < 2 || !selectedListId}>
            <Dices className="mr-2"/>Sortear Participantes
          </Button>
          {!selectedListId && (
            <p className="text-amber-600 mt-4">Selecione uma lista de palavras para começar.</p>
          )}
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
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center">
        <Card className="w-full max-w-2xl shadow-xl">
             <CardHeader>
                <CardTitle>Configuração do Sorteio</CardTitle>
                <CardDescription>Selecione a lista de palavras para a disputa atual.</CardDescription>
            </CardHeader>
            <CardContent>
                <Select onValueChange={setSelectedListId} value={selectedListId || ''} disabled={raffleState !== 'idle'}>
                    <SelectTrigger className="mb-4">
                        <SelectValue placeholder="Selecione uma lista de palavras" />
                    </SelectTrigger>
                    <SelectContent>
                        {wordLists.map(list => (
                            <SelectItem key={list.id} value={list.id}>{list.name} ({list.words.length} palavras)</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
