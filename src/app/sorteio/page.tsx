'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw, PartyPopper, Projector } from 'lucide-react';
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
import { ref, set, onValue, get, child, update } from 'firebase/database';


type RaffleState = 'idle' | 'participants_sorted' | 'word_sorted' | 'round_finished';
type DisputeState = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'ROUND_WINNER' | 'FINAL_WINNER' | 'RESET';
    participantA?: Participant | null;
    participantB?: Participant | null;
    word?: string | null;
    winner?: Participant | null;
    loser?: Participant | null;
    finalWinner?: Participant | null;
}

const setDisputeState = (state: DisputeState | null) => {
    set(ref(database, 'dispute/state'), state);
}

export default function RafflePage() {
  const [words, setWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [participants, setParticipants] = useState<{ groupA: Participant[], groupB: Participant[] } | null>(null);
  
  const [currentDuel, setCurrentDuel] = useState<{ participantA: Participant, participantB: Participant } | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [raffleState, setRaffleState] = useState<RaffleState>('idle');
  const [roundWinner, setRoundWinner] = useState<Participant | null>(null);
  const [showFinalWinnerDialog, setShowFinalWinnerDialog] = useState(false);
  const [finalWinner, setFinalWinner] = useState<Participant | null>(null);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const participantsRef = ref(database, 'participants');
    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const sanitizedData = {
                groupA: data.groupA || [],
                groupB: data.groupB || []
            };
            setParticipants(sanitizedData);
            checkForWinner(sanitizedData);
        } else {
            toast({ variant: "destructive", title: "Erro", description: "Participantes não encontrados."});
            router.push('/');
        }
    });

    const wordsRef = ref(database, 'dispute/words');
    const unsubscribeWords = onValue(wordsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setWords(data);
            setAvailableWords(data);
        } else {
             toast({ variant: "destructive", title: "Erro", description: "Palavras não encontradas."});
             router.push('/disputa');
        }
    });
    
    setDisputeState({ type: 'RESET' });

    return () => {
        unsubscribeParticipants();
        unsubscribeWords();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const checkForWinner = (currentParticipants: { groupA: Participant[], groupB: Participant[] }) => {
    if (!currentParticipants || finalWinner) return;
    
    const activeGroupA = currentParticipants.groupA.filter(p => !p.eliminated);
    const activeGroupB = currentParticipants.groupB.filter(p => !p.eliminated);

    let winner: Participant | null = null;
    
    if (activeGroupA.length > 0 && activeGroupB.length === 0) {
        winner = activeGroupA.reduce((prev, current) => (prev.stars > current.stars) ? prev : current);
    } else if (activeGroupB.length > 0 && activeGroupA.length === 0) {
        winner = activeGroupB.reduce((prev, current) => (prev.stars > current.stars) ? prev : current);
    } else if (activeGroupA.length === 0 && activeGroupB.length === 0 && (currentParticipants.groupA.length > 0 || currentParticipants.groupB.length > 0)) {
         const allParticipants = [...currentParticipants.groupA, ...currentParticipants.groupB];
         if(allParticipants.length > 0){
            winner = allParticipants.reduce((prev, current) => (prev.stars > current.stars) ? prev : current);
         }
    }


    if (winner) {
      setFinalWinner(winner);
      setShowFinalWinnerDialog(true);
      setDisputeState({ type: 'FINAL_WINNER', finalWinner: winner });
    }
  }

  const sortParticipants = () => {
    if (!participants) return;
    
    setRoundWinner(null);
    setCurrentWord(null);
    setDisputeState({ type: 'RESET' });

    let activeGroupA = participants.groupA.filter(p => !p.eliminated);
    let activeGroupB = participants.groupB.filter(p => !p.eliminated);

    if (activeGroupA.length === 0 || activeGroupB.length === 0) {
      checkForWinner(participants);
      if(!finalWinner) {
        toast({ variant: "destructive", title: "Sorteio Inválido", description: "É preciso ter participantes ativos nos dois grupos." });
      }
      return;
    }
    
    const participantA = activeGroupA[Math.floor(Math.random() * activeGroupA.length)];
    const participantB = activeGroupB[Math.floor(Math.random() * activeGroupB.length)];

    setCurrentDuel({ participantA, participantB });
    setRaffleState('participants_sorted');
    setDisputeState({ type: 'UPDATE_PARTICIPANTS', participantA, participantB });
  };

  const sortWord = () => {
    let currentAvailableWords = availableWords;
    if (currentAvailableWords.length === 0) {
      toast({ title: "Aviso", description: "Todas as palavras já foram sorteadas. Reiniciando a lista de palavras." });
      setAvailableWords(words);
      currentAvailableWords = words;
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
    const loser = winnerIsA ? currentDuel.participantB : currentDuel.A;

    const winnerGroupKey = winner.id.startsWith('A') ? 'groupA' : 'groupB';
    const loserGroupKey = loser.id.startsWith('A') ? 'groupA' : 'groupB';
    
    const winnerIndex = participants[winnerGroupKey].findIndex(p => p.id === winner.id);
    const loserIndex = participants[loserGroupKey].findIndex(p => p.id === loser.id);
    
    const updates: any = {};
    const newStars = (participants[winnerGroupKey][winnerIndex].stars || 0) + 1;
    
    updates[`/participants/${winnerGroupKey}/${winnerIndex}/stars`] = newStars;
    updates[`/participants/${loserGroupKey}/${loserIndex}/eliminated`] = true;
    
    await update(ref(database), updates);
    
    winner.stars = newStars;
    setRoundWinner(winner);

    setDisputeState({ type: 'ROUND_WINNER', winner, loser, word: currentWord });
    toast({
      title: "Disputa Encerrada!",
      description: `${winner.name} venceu a rodada e ganhou uma estrela!`,
    });
    
    setRaffleState('round_finished');
    
    // Check for final winner after state has been updated
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, 'participants'));
    if(snapshot.exists()) {
        setTimeout(() => checkForWinner(snapshot.val()), 100);
    }
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
    
    const activeParticipantsA = participants.groupA?.filter(p => !p.eliminated).length || 0;
    const activeParticipantsB = participants.groupB?.filter(p => !p.eliminated).length || 0;

    if (raffleState === 'idle') {
      return (
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl font-bold">Próxima Rodada</h2>
          <div className="text-lg text-muted-foreground">
            <p>Grupo A: {activeParticipantsA} participantes</p>
            <p>Grupo B: {activeParticipantsB} participantes</p>
          </div>
          <Button size="lg" onClick={sortParticipants} disabled={finalWinner != null || (activeParticipantsA === 0 || activeParticipantsB === 0)}>
            <Dices className="mr-2"/>Sortear Participantes
          </Button>
          {(activeParticipantsA === 0 || activeParticipantsB === 0) && (activeParticipantsA > 0 || activeParticipantsB > 0) && !finalWinner &&(
             <p className="text-amber-600 mt-4">Um dos grupos não tem mais participantes. Clique em "Sortear Participantes" para declarar o vencedor.</p>
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
            <p className="text-muted-foreground">{activeParticipantsA} vs {activeParticipantsB}</p>
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
        <Card className="w-full max-w-2xl min-h-[28rem] flex items-center justify-center shadow-2xl">
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
