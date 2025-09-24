
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw, PartyPopper } from 'lucide-react';
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

type RaffleState = 'idle' | 'participants_sorted' | 'word_sorted' | 'round_finished';
type DisputeAction = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'ROUND_WINNER' | 'FINAL_WINNER' | 'RESET';
    participantA?: Participant | null;
    participantB?: Participant | null;
    word?: string | null;
    winner?: Participant | null;
    loser?: Participant | null;
    timestamp?: number;
}

const setDisputeAction = (action: Omit<DisputeAction, 'timestamp'>) => {
    localStorage.setItem('disputeAction', JSON.stringify({ ...action, timestamp: new Date().getTime() }));
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
    const storedParticipants = localStorage.getItem('participants');
    if (storedParticipants) {
      const parsed = JSON.parse(storedParticipants);
      const ensureData = (p: Participant) => ({ ...p, stars: p.stars || 0, eliminated: p.eliminated || false });
      parsed.groupA = parsed.groupA.map(ensureData);
      parsed.groupB = parsed.groupB.map(ensureData);
      setParticipants(parsed);
    } else {
        toast({ variant: "destructive", title: "Erro", description: "Participantes não encontrados."});
        router.push('/');
    }

    const storedWords = localStorage.getItem('words');
    if (storedWords) {
      const parsedWords = JSON.parse(storedWords);
      setWords(parsedWords);
      setAvailableWords(parsedWords);
    } else {
        toast({ variant: "destructive", title: "Erro", description: "Palavras não encontradas."});
        router.push('/disputa');
    }

    setDisputeAction({ type: 'RESET' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const checkForWinner = (currentParticipants: { groupA: Participant[], groupB: Participant[] }) => {
    if (!currentParticipants) return;
    
    const activeGroupA = currentParticipants.groupA.filter(p => !p.eliminated);
    const activeGroupB = currentParticipants.groupB.filter(p => !p.eliminated);

    let winner: Participant | null = null;
    if (activeGroupA.length > 0 && activeGroupB.length === 0) {
      if (activeGroupA.length === 1) {
        winner = activeGroupA[0];
      }
    } else if (activeGroupB.length > 0 && activeGroupA.length === 0) {
      if (activeGroupB.length === 1) {
        winner = activeGroupB[0];
      }
    }

    if (winner && !finalWinner) {
      setFinalWinner(winner);
      setShowFinalWinnerDialog(true);
      setDisputeAction({ type: 'FINAL_WINNER', winner });
    }
  }

  const sortParticipants = () => {
    if (!participants) return;
    
    setRoundWinner(null);
    setCurrentWord(null);
    setDisputeAction({ type: 'HIDE_WORD' });

    let activeGroupA = participants.groupA.filter(p => !p.eliminated);
    let activeGroupB = participants.groupB.filter(p => !p.eliminated);

    if (activeGroupA.length === 0 || activeGroupB.length === 0) {
      toast({ variant: "destructive", title: "Sorteio Inválido", description: "É preciso ter participantes ativos nos dois grupos." });
      checkForWinner(participants);
      return;
    }
    
    const participantA = activeGroupA[Math.floor(Math.random() * activeGroupA.length)];
    const participantB = activeGroupB[Math.floor(Math.random() * activeGroupB.length)];

    setCurrentDuel({ participantA, participantB });
    setRaffleState('participants_sorted');
    setDisputeAction({ type: 'UPDATE_PARTICIPANTS', participantA, participantB });
  };

  const sortWord = () => {
    let currentAvailableWords = availableWords;
    if (currentAvailableWords.length === 0) {
      toast({ title: "Aviso", description: "Todas as palavras já foram sorteadas. Reiniciando a lista de palavras." });
      setAvailableWords(words);
      currentAvailableWords = words;
    }

    const wordIndex = Math.floor(Math.random() * currentAvailableWords.length);
    const sortedWord = currentAvailableWords[wordIndex];
    
    setCurrentWord(sortedWord);
    setAvailableWords(prev => prev.filter((_, i) => i !== wordIndex));
    setRaffleState('word_sorted');
    setDisputeAction({ type: 'SHOW_WORD', word: sortedWord });
  };
  
  const handleWinner = (winnerId: string) => {
    if (!currentDuel || !currentWord) return;

    const winnerIsA = currentDuel.participantA.id === winnerId;
    const winner = winnerIsA ? currentDuel.participantA : currentDuel.participantB;
    const loser = winnerIsA ? currentDuel.participantB : currentDuel.participantA;

    const updatedParticipants = (() => {
        if (!participants) return null;
        
        const winnerGroupKey = winner.id.startsWith('A') ? 'groupA' : 'groupB';
        const loserGroupKey = loser.id.startsWith('A') ? 'groupA' : 'groupB';

        const nextState = { ...participants };
        
        nextState[winnerGroupKey] = nextState[winnerGroupKey].map(p => 
            p.id === winner.id ? { ...p, stars: (p.stars || 0) + 1 } : p
        );

        nextState[loserGroupKey] = nextState[loserGroupKey].map(p => 
            p.id === loser.id ? { ...p, eliminated: true } : p
        );

        return nextState;
    })();

    if (updatedParticipants) {
        setParticipants(updatedParticipants);
        localStorage.setItem('participants', JSON.stringify(updatedParticipants));
        checkForWinner(updatedParticipants);
    }
    
    const finalWinnerData = winner; // Winner with updated stars
    setRoundWinner(finalWinnerData);

    setDisputeAction({ type: 'ROUND_WINNER', winner: finalWinnerData, loser, word: currentWord });
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
    setDisputeAction({ type: 'RESET' });
    if(participants) checkForWinner(participants);
  }

  const renderState = () => {
    if (!participants) {
      return <p className="text-center text-muted-foreground">Carregando...</p>;
    }
    
    const activeParticipantsA = participants.groupA.filter(p => !p.eliminated).length;
    const activeParticipantsB = participants.groupB.filter(p => !p.eliminated).length;

    if (raffleState === 'idle') {
      return (
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl font-bold">Próxima Rodada</h2>
          <div className="text-lg text-muted-foreground">
            <p>Grupo A: {activeParticipantsA} participantes</p>
            <p>Grupo B: {activeParticipantsB} participantes</p>
          </div>
          <Button size="lg" onClick={sortParticipants} disabled={finalWinner != null || activeParticipantsA === 0 || activeParticipantsB === 0}>
            <Dices className="mr-2"/>Sortear Participantes
          </Button>
          {(activeParticipantsA === 0 || activeParticipantsB === 0) && activeParticipantsA + activeParticipantsB > 0 && !finalWinner &&(
             <p className="text-amber-600">Um dos grupos não tem mais participantes. Verificando o vencedor final...</p>
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
            <p className="text-muted-foreground">{participants.groupA.filter(p => !p.eliminated).length} vs {participants.groupB.filter(p => !p.eliminated).length}</p>
            <Button size="lg" onClick={nextRound} disabled={finalWinner != null}><RefreshCw className="mr-2" />Próxima Rodada</Button>
        </div>
      )
    }
    
    return null;
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl min-h-[28rem] flex items-center justify-center shadow-2xl">
            <CardContent className="pt-10 w-full">
                {renderState()}
            </CardContent>
        </Card>

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
