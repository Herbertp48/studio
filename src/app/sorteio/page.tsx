
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type RaffleState = 'idle' | 'participants_sorted' | 'word_sorted' | 'round_finished';

export default function RafflePage() {
  const [words, setWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [participants, setParticipants] = useState<{ groupA: Participant[], groupB: Participant[] } | null>(null);
  const [currentDuel, setCurrentDuel] = useState<{ participantA: Participant, participantB: Participant } | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [raffleState, setRaffleState] = useState<RaffleState>('idle');
  const [winner, setWinner] = useState<Participant | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const storedParticipants = localStorage.getItem('participants');
    if (storedParticipants) {
      const parsed = JSON.parse(storedParticipants);
      // Ensure stars property exists
      parsed.groupA.forEach((p: Participant) => p.stars = p.stars || 0);
      parsed.groupB.forEach((p: Participant) => p.stars = p.stars || 0);
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
  }, [router, toast]);
  
  useEffect(() => {
    if (participants) {
      localStorage.setItem('participants', JSON.stringify(participants));
    }
  }, [participants]);

  const sortParticipants = () => {
    if (!participants || participants.groupA.length === 0 || participants.groupB.length === 0) {
      toast({ variant: "destructive", title: "Sorteio Inválido", description: "É preciso ter participantes nos dois grupos." });
      return;
    }
    
    setWinner(null);
    setCurrentWord(null);

    const participantA = participants.groupA[Math.floor(Math.random() * participants.groupA.length)];
    const participantB = participants.groupB[Math.floor(Math.random() * participants.groupB.length)];

    setCurrentDuel({ participantA, participantB });
    setRaffleState('participants_sorted');
  };

  const sortWord = () => {
    if (availableWords.length === 0) {
      toast({ variant: "destructive", title: "Fim das palavras", description: "Todas as palavras já foram sorteadas." });
      return;
    }

    const wordIndex = Math.floor(Math.random() * availableWords.length);
    const sortedWord = availableWords[wordIndex];
    
    setCurrentWord(sortedWord);
    setAvailableWords(prev => prev.filter((_, i) => i !== wordIndex));
    setRaffleState('word_sorted');
  };
  
  const handleWinner = (winnerId: string) => {
    if (!currentDuel || !currentWord) return;

    const isWinnerA = currentDuel.participantA.id === winnerId;
    const roundWinner = isWinnerA ? currentDuel.participantA : currentDuel.participantB;
    const roundLoser = isWinnerA ? currentDuel.participantB : currentDuel.participantA;

    setParticipants(prev => {
      if (!prev) return null;
      
      const winnerGroupKey = roundWinner.id.startsWith('A') ? 'groupA' : 'groupB';
      const loserGroupKey = roundLoser.id.startsWith('A') ? 'groupA' : 'groupB';

      const nextState = { ...prev };
      
      // Update winner's stars
      nextState[winnerGroupKey] = nextState[winnerGroupKey].map(p => 
        p.id === roundWinner.id ? { ...p, stars: (p.stars || 0) + 1 } : p
      );

      // Remove loser
      nextState[loserGroupKey] = nextState[loserGroupKey].filter(p => p.id !== roundLoser.id);

      return nextState;
    });

    setWinner(roundWinner);
    toast({ title: "Disputa Encerrada!", description: `${roundWinner.name} venceu a rodada!`});
    
    // Check for overall winner
    if (participants && (participants.groupA.length === 0 || participants.groupB.length === 0) && participants[isWinnerA ? 'groupA' : 'groupB'].length === 1) {
        setIsFinishing(true);
    } else {
        setRaffleState('round_finished');
    }
  };
  
  const nextRound = () => {
    setCurrentDuel(null);
    setCurrentWord(null);
    setWinner(null);
    setRaffleState('idle');
  }

  const getOverallWinner = () => {
    if(!participants) return null;
    if (participants.groupA.length > 0 && participants.groupB.length === 0) {
        return participants.groupA[0];
    }
    if (participants.groupB.length > 0 && participants.groupA.length === 0) {
        return participants.groupB[0];
    }
    return null;
  }
  
  const finishCompetition = () => {
    const finalWinner = getOverallWinner();
    if (finalWinner) {
        setWinner(finalWinner);
        setIsFinishing(true);
    }
  }

  const renderState = () => {
    if (!participants) {
      return <p>Carregando...</p>;
    }
    
    if (raffleState === 'idle') {
        return (
            <div className="text-center">
                <p className="text-xl mb-6">Pronto para a próxima rodada?</p>
                <Button size="lg" onClick={sortParticipants}><Dices className="mr-2"/>Sortear Participantes</Button>
            </div>
        )
    }

    if (raffleState === 'participants_sorted' && currentDuel) {
        return (
            <div className="text-center">
                <p className="text-lg mb-4">Participantes sorteados!</p>
                <p className="text-2xl font-bold">{currentDuel.participantA.name} vs. {currentDuel.participantB.name}</p>
                <Button size="lg" onClick={sortWord} className="mt-6">Sortear Palavra</Button>
            </div>
        )
    }
    
    if (raffleState === 'word_sorted' && currentDuel && currentWord) {
        return (
            <div className="text-center">
                <p className="text-lg mb-2">A palavra é:</p>
                <p className="text-4xl font-bold tracking-widest uppercase mb-8">{currentWord}</p>
                <p className="text-lg mb-4">Quem venceu a disputa?</p>
                <div className="flex justify-center gap-4">
                    <Button variant="outline" size="lg" onClick={() => handleWinner(currentDuel.participantA.id)}>
                        <Trophy className="mr-2"/> {currentDuel.participantA.name}
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => handleWinner(currentDuel.participantB.id)}>
                        <Trophy className="mr-2"/> {currentDuel.participantB.name}
                    </Button>
                </div>
            </div>
        )
    }

    if (raffleState === 'round_finished' && winner) {
        return (
            <div className="text-center">
                <p className="text-2xl font-bold mb-4">{winner.name} venceu a rodada!</p>
                <p className="text-lg mb-6 text-yellow-500 flex items-center justify-center gap-2">
                    <Star /> Ganhou 1 estrela!
                </p>
                <Button size="lg" onClick={nextRound}><RefreshCw className="mr-2" />Próxima Rodada</Button>
            </div>
        )
    }
    
    return null;
  }
  
  const finalWinner = getOverallWinner();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Coluna Esquerda - Participantes */}
            <div className="md:col-span-1 space-y-4">
                <Card>
                    <CardHeader><CardTitle>Grupo A ({participants?.groupA.length})</CardTitle></CardHeader>
                    <CardContent>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            {participants?.groupA.map(p => (
                                <li key={p.id} className="flex justify-between items-center">
                                    <span>{p.name}</span>
                                    <span className="flex items-center gap-1 text-yellow-500 font-bold">{p.stars > 0 && `x${p.stars}`}<Star className="w-4 h-4" /></span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Grupo B ({participants?.groupB.length})</CardTitle></CardHeader>
                    <CardContent>
                         <ul className="space-y-1 text-sm text-muted-foreground">
                            {participants?.groupB.map(p => (
                                <li key={p.id} className="flex justify-between items-center">
                                    <span>{p.name}</span>
                                    <span className="flex items-center gap-1 text-yellow-500 font-bold">{p.stars > 0 && `x${p.stars}`}<Star className="w-4 h-4" /></span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>

            {/* Coluna Direita - Sorteio */}
            <div className="md:col-span-2">
                <Card className="min-h-[24rem] flex items-center justify-center">
                    <CardContent className="pt-6">
                        {renderState()}
                    </CardContent>
                </Card>
            </div>
        </div>

        <AlertDialog open={isFinishing} onOpenChange={setIsFinishing}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle className="text-center text-2xl">A disputa acabou!</AlertDialogTitle>
                <AlertDialogDescription className="text-center text-lg">
                    <div className="flex flex-col items-center justify-center gap-4 py-4">
                        <Crown className="w-16 h-16 text-yellow-500" />
                        <p className="text-xl font-bold">O grande vencedor é</p>
                        <p className="text-3xl font-bold text-foreground">{finalWinner?.name}</p>
                    </div>
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => router.push('/')}>Voltar para o Início</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
}

    