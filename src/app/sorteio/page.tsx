
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw, PartyPopper, Projector, Eye, ShieldAlert } from 'lucide-react';
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
import { Input } from '@/components/ui/input';

export type WordList = {
    id: string;
    name: string;
    words: string[];
}

type RaffleState = 'idle' | 'participants_sorted' | 'word_preview' | 'word_sorted' | 'word_finished' | 'duel_finished' | 'shuffling';
type SortMode = 'random' | 'sequential';
type DisputeState = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'WORD_WINNER' | 'DUEL_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'TIE_ANNOUNCEMENT' | 'NO_WINNER' | 'NO_WORD_WINNER';
    payload?: any;
}

const setDisputeState = (state: DisputeState | null) => {
    set(ref(database, 'dispute/state'), state);
}

function RafflePageContent() {
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [participants, setParticipants] = useState<{ [key: string]: Participant }>({});
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  
  const [currentDuel, setCurrentDuel] = useState<{ participantA: Participant, participantB: Participant } | null>(null);
  const [currentWords, setCurrentWords] = useState<string[] | null>(null);
  const [raffleState, setRaffleState] = useState<RaffleState>('idle');
  const [showFinalWinnerDialog, setShowFinalWinnerDialog] = useState(false);
  const [finalWinners, setFinalWinners] = useState<Participant[]>([]);
  const [isTie, setIsTie] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>('random');
  const [manualReveal, setManualReveal] = useState(false);
  const [originalWords, setOriginalWords] = useState<string[]>([]);
  const shufflingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [wordsPerRound, setWordsPerRound] = useState(1);
  const [wordsPlayed, setWordsPlayed] = useState(0);
  const [duelScore, setDuelScore] = useState({ a: 0, b: 0 });
  const [duelWordsWon, setDuelWordsWon] = useState<{a: string[], b: string[]}>({a: [], b: []});

  const { toast } = useToast();
  const router = useRouter();

  const participantsList = Object.values(participants);

  const checkForWinner = (currentParticipants: { [key: string]: Participant }) => {
    if (!currentParticipants || Object.keys(currentParticipants).length === 0) return;

    const activeParticipants = Object.values(currentParticipants).filter(p => !p.eliminated);

    if (activeParticipants.length < 2) {
        if (shufflingIntervalRef.current) {
            clearInterval(shufflingIntervalRef.current);
            shufflingIntervalRef.current = null;
        }

        const allParticipants = Object.values(currentParticipants);
        const maxStars = Math.max(0, ...allParticipants.map(p => p.stars));
        
        // Correctly identify winners, even if maxStars is 0.
        const winners = allParticipants.filter(p => p.stars === maxStars);
        
        if (activeParticipants.length < 2) {
            setShowFinalWinnerDialog(true);
            if (winners.length > 1) { // Tie
                setFinalWinners(winners);
                setIsTie(true);
                setDisputeState({ type: 'TIE_ANNOUNCEMENT', payload: { participants: winners } });
            } else if (winners.length === 1 && activeParticipants.length === 1 && winners[0].id === activeParticipants[0].id) { // Single winner
                setFinalWinners(winners);
                setIsTie(false);
                setDisputeState({ type: 'FINAL_WINNER', payload: { finalWinner: winners[0] } });
            } else { // No clear winner (e.g., all eliminated with 0 stars)
                setFinalWinners([]);
                setIsTie(false);
                setDisputeState({ type: 'NO_WINNER' });
            }
        }
    }
}


  useEffect(() => {
    const disputeRef = ref(database, 'dispute');

    const unsubscribe = onValue(disputeRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.participants && data.words) {
            const currentParticipants = data.participants || {};
            setParticipants(currentParticipants);
            
            if (originalWords.length === 0 && data.words.length > 0) {
              setAvailableWords(data.words);
              setOriginalWords(data.words);
            }
            // Only check for winner if we are in a state that expects it
            if (raffleState === 'idle' || raffleState === 'duel_finished') {
                checkForWinner(currentParticipants);
            }
        } else {
            if(router) {
              toast({ variant: "destructive", title: "Erro", description: "Dados da disputa não encontrados."});
              router.push('/disputa');
            }
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
        if (shufflingIntervalRef.current) {
            clearInterval(shufflingIntervalRef.current);
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  
  const sortParticipants = () => {
    if (!participants || raffleState === 'shuffling') return;
    
    setDisputeState({ type: 'RESET' });
    setCurrentWords(null);

    let activeParticipants = Object.values(participants).filter(p => !p.eliminated);

    if (activeParticipants.length < 2) {
      toast({ variant: "destructive", title: "Fim da Disputa", description: "Não há participantes ativos suficientes para uma nova rodada." });
      checkForWinner(participants);
      return;
    }

    setRaffleState('shuffling');
    setDisputeState({ type: 'SHUFFLING_PARTICIPANTS', payload: { activeParticipants } });

    setTimeout(() => {
        if (shufflingIntervalRef.current) {
            clearInterval(shufflingIntervalRef.current);
            shufflingIntervalRef.current = null;
        }

        const shuffled = [...activeParticipants].sort(() => 0.5 - Math.random());
        const participantA = shuffled[0];
        const participantB = shuffled[1];

        setCurrentDuel({ participantA, participantB });
        setWordsPlayed(0);
        setDuelScore({a: 0, b: 0});
        setDuelWordsWon({a: [], b: []});
        setRaffleState('participants_sorted');
        setDisputeState({ type: 'UPDATE_PARTICIPANTS', payload: { participantA, participantB, duelScore: {a: 0, b: 0} } });
    }, 4000); // Animation duration
  };

  const sortWord = () => {
    setDisputeState({ type: 'HIDE_WORD' });

    if (availableWords.length === 0) {
      toast({ title: "Aviso", description: "Não há palavras suficientes. Reiniciando a lista de palavras." });
      setAvailableWords(originalWords);
    }
     if (availableWords.length === 0) {
        toast({ variant: "destructive", title: "Erro", description: "Nenhuma palavra disponível para sorteio, mesmo após reiniciar a lista." });
        return;
    }

    let remainingWords = [...availableWords];
    let wordsToDraw = [];
    
    for (let i = 0; i < 1; i++) { // Always draw one word at a time
        if (remainingWords.length === 0) {
            toast({ title: "Aviso", description: "Não há palavras suficientes. Reiniciando a lista de palavras." });
            remainingWords = [...originalWords];
            if (remainingWords.length === 0) break;
        }

        let wordIndex: number;
        if (sortMode === 'sequential') {
            wordIndex = 0;
        } else {
            wordIndex = Math.floor(Math.random() * remainingWords.length);
        }
        const [sortedWord] = remainingWords.splice(wordIndex, 1);
        wordsToDraw.push(sortedWord);
    }
    
    setAvailableWords(remainingWords);

    if (wordsToDraw.length > 0) {
      setCurrentWords(wordsToDraw);
      if (manualReveal) {
          setRaffleState('word_preview');
      } else {
          setRaffleState('word_sorted');
          setDisputeState({ type: 'SHOW_WORD', payload: { words: wordsToDraw, participantA: currentDuel?.participantA, participantB: currentDuel?.participantB, duelScore } });
      }
    }
  };

  const revealWord = () => {
    if (!currentWords || !currentDuel) return;
    setRaffleState('word_sorted');
    setDisputeState({ type: 'SHOW_WORD', payload: { words: currentWords, participantA: currentDuel.participantA, participantB: currentDuel.participantB, duelScore } });
  };
  
  const finishDuel = async (duelWinner: Participant, duelLoser: Participant) => {
    const updates: { [key: string]: any } = {};
    const newStars = (duelWinner.stars || 0) + 1;

    updates[`/dispute/participants/${duelWinner.id}/stars`] = newStars;
    updates[`/dispute/participants/${duelLoser.id}/eliminated`] = true;
    
    const starWinnerEntryRef = push(ref(database, 'winners'));
    await set(starWinnerEntryRef, {
        name: duelWinner.name,
        word: `Duelo Vencido (+1 Estrela)`,
        stars: 1 
    });

    await update(ref(database), updates);

    const winnerUpdate = { ...duelWinner, stars: newStars };
    const loserUpdate = { ...duelLoser, eliminated: true };
    
    setParticipants(prev => ({
        ...prev,
        [duelWinner.id]: winnerUpdate,
        [duelLoser.id]: loserUpdate,
    }));

    const winnerWordsWon = duelWinner.id === currentDuel?.participantA.id ? duelWordsWon.a : duelWordsWon.b;
    setDisputeState({ type: 'DUEL_WINNER', payload: { winner: winnerUpdate, duelWordsWon: winnerWordsWon } });
    
    toast({
        title: "Duelo Encerrado!",
        description: `${duelWinner.name} venceu o duelo e ganhou uma estrela!`,
    });
    
    setRaffleState('duel_finished');
  }

  const handleDuelResult = (newScore: {a: number, b: number}, newWordsPlayed: number) => {
    if (!currentDuel) return;

    const isDuelOver = newWordsPlayed >= wordsPerRound && newScore.a !== newScore.b;

    if (isDuelOver) {
        const duelWinner = newScore.a > newScore.b ? currentDuel.participantA : currentDuel.participantB;
        const duelLoser = newScore.a > newScore.b ? currentDuel.participantB : currentDuel.A;
        finishDuel(duelWinner, duelLoser);
    } else {
        // Wait for message to show on projector before changing state
        setTimeout(() => {
            setRaffleState('word_finished'); 
            setDisputeState({type: 'UPDATE_PARTICIPANTS', payload: { participantA: currentDuel.participantA, participantB: currentDuel.participantB, duelScore: newScore } });
            setCurrentWords(null);
        }, 4000);
    }
  }

  const handleWordWinner = async (wordWinnerId: string) => {
    if (!currentDuel || !currentWords) return;

    const wordWinner = wordWinnerId === currentDuel.participantA.id ? currentDuel.participantA : currentDuel.participantB;
    
    const newWinnerEntryRef = push(ref(database, 'winners'));
    await set(newWinnerEntryRef, {
        name: wordWinner.name,
        word: currentWords[0],
        stars: 0
    });

    setDisputeState({ type: 'WORD_WINNER', payload: { winner: wordWinner, words: currentWords } });
    toast({ title: 'Ponto Marcado!', description: `${wordWinner.name} venceu a disputa pela palavra "${currentWords[0]}"!` });

    const newScore = { ...duelScore };
    const newWordsWon = { ...duelWordsWon };

    if (wordWinnerId === currentDuel.participantA.id) {
        newScore.a++;
        newWordsWon.a.push(currentWords[0]);
    } else {
        newScore.b++;
        newWordsWon.b.push(currentWords[0]);
    }

    const newWordsPlayed = wordsPlayed + 1;
    setWordsPlayed(newWordsPlayed);
    setDuelScore(newScore);
    setDuelWordsWon(newWordsWon);
    
    handleDuelResult(newScore, newWordsPlayed);
};
  
  const handleNoWinner = async () => {
    if (!currentWords || !currentDuel) return;

    setDisputeState({ type: 'NO_WORD_WINNER', payload: { words: currentWords } });
    toast({ title: 'Palavra sem vencedor', description: 'Ninguém pontuou.' });
    
    const newWordsPlayed = wordsPlayed + 1;
    setWordsPlayed(newWordsPlayed);

    handleDuelResult(duelScore, newWordsPlayed);
  }

  const nextRound = () => {
    setCurrentDuel(null);
    setCurrentWords(null);
    setDuelScore({ a: 0, b: 0 });
    setWordsPlayed(0);
    setDuelWordsWon({ a: [], b: [] });
    setDisputeState({ type: 'RESET' });
    setRaffleState('idle'); 
    
    setTimeout(() => {
      const dbRef = ref(database, 'dispute/participants');
      get(dbRef).then(snapshot => {
        if (snapshot.exists()) {
          checkForWinner(snapshot.val());
        }
      });
    }, 100);
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

    const startTieBreaker = async () => {
        setShowFinalWinnerDialog(false);
        setFinalWinners([]);
        setIsTie(false);
    
        const updates: { [key: string]: any } = {};
        const finalistIds = finalWinners.map(winner => winner.id);
    
        participantsList.forEach(p => {
             if (finalistIds.includes(p.id)) {
                updates[`/dispute/participants/${p.id}/eliminated`] = false;
            } else if (!p.eliminated) {
                updates[`/dispute/participants/${p.id}/eliminated`] = true;
            }
        });

        await update(ref(database), updates);

        nextRound();
        toast({ title: "Desempate!", description: "A rodada de desempate começou." });
    }
  
  const renderWordButtons = () => {
    if (!currentWords || !currentDuel) return null;
    const word = currentWords[0];

    return (
      <Card className="p-4 flex flex-col items-center gap-2 bg-muted/50 w-full">
        <p className="text-xl font-bold tracking-wider uppercase text-primary">{word}</p>
        <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleWordWinner(currentDuel.participantA.id)}>{currentDuel.participantA.name}</Button>
            <Button size="sm" variant="outline" onClick={() => handleWordWinner(currentDuel.participantB.id)}>{currentDuel.participantB.name}</Button>
        </div>
      </Card>
    );
  }

  const renderState = () => {
    if (!participants) {
      return <p className="text-center text-muted-foreground">Carregando...</p>;
    }
    
    const activeParticipantsCount = Object.values(participants).filter(p => !p.eliminated).length;

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
          <Button size="lg" onClick={sortParticipants} disabled={showFinalWinnerDialog || activeParticipantsCount < 2 || raffleState === 'shuffling'}>
            <Dices className="mr-2"/>Sortear Participantes
          </Button>
          {activeParticipantsCount < 2 && !showFinalWinnerDialog && (
             <p className="text-amber-600 mt-4">Não há participantes ativos suficientes para uma disputa.</p>
          )}
        </div>
      )
    }

    if ((raffleState === 'participants_sorted' || raffleState === 'word_finished') && currentDuel) {
      const duelIsTie = wordsPlayed >= wordsPerRound && duelScore.a === duelScore.b;
      return (
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-primary">Disputa em Andamento!</h2>
          <div className="flex items-center justify-center gap-4 text-2xl font-semibold">
              <div className="flex flex-col items-center gap-1">
                <Trophy className="text-amber-400" />
                <span>{currentDuel.participantA.name}</span>
                <span className='text-lg font-bold'>Pontos: {duelScore.a}</span>
              </div>
              <span className="text-muted-foreground self-center">vs.</span>
              <div className="flex flex-col items-center gap-1">
                <Trophy className="text-amber-400" />
                <span>{currentDuel.participantB.name}</span>
                 <span className='text-lg font-bold'>Pontos: {duelScore.b}</span>
              </div>
          </div>
          <p className='text-muted-foreground'>Palavra {wordsPlayed + 1} de {wordsPerRound}{duelIsTie ? " (Desempate!)" : ""}</p>
          <Button size="lg" onClick={sortWord} className="mt-4">
            <PartyPopper className="mr-2"/>Sortear Palavra
          </Button>
        </div>
      )
    }

    if (raffleState === 'word_preview' && currentWords) {
       return (
         <div className="text-center flex flex-col items-center gap-6">
            <p className="text-lg text-muted-foreground">Palavra sorteada (apenas para você):</p>
            <p className="text-3xl font-bold tracking-widest uppercase text-primary">{currentWords[0]}</p>
            <Button size="lg" onClick={revealWord} className="mt-4 bg-amber-500 hover:bg-amber-600">
                <Eye className="mr-2"/>Revelar no Projetor
            </Button>
        </div>
       )
    }
    
    if (raffleState === 'word_sorted' && currentDuel && currentWords) {
      return (
        <div className="text-center flex flex-col items-center gap-6 w-full">
            <p className="text-lg text-muted-foreground">Quem venceu a disputa com a palavra?</p>
            <div className="w-full">
                {renderWordButtons()}
            </div>
            <p className="text-xl font-semibold mt-4">Ou...</p>
            <Button variant="secondary" size="lg" onClick={handleNoWinner}>
                <RefreshCw className="mr-2" /> Ninguém Acertou
            </Button>
        </div>
      )
    }

    if (raffleState === 'duel_finished') {
        const winner = participants[currentDuel?.participantA.id || '']?.stars > participants[currentDuel?.participantB.id || '']?.stars 
            ? currentDuel?.participantA 
            : currentDuel?.participantB;
        
        const message = `${winner?.name} venceu o duelo!`;

        return (
            <div className="text-center flex flex-col items-center gap-6">
                <h2 className="text-3xl font-bold">{message}</h2>
                {winner && (
                    <p className="text-xl text-amber-500 flex items-center justify-center gap-2">
                        <Star /> Ganhou 1 estrela!
                    </p>
                )}
                <p className="text-muted-foreground">{Object.values(participants).filter(p => !p.eliminated).length} participantes restantes</p>
                <Button size="lg" onClick={nextRound}><RefreshCw className="mr-2" />Próxima Rodada</Button>
            </div>
        )
    }
    
    return null;
  }
  
  return (
    <div className="flex flex-col w-full bg-background text-foreground">
      <AppHeader />
      <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center">
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
                    <Label htmlFor="words-per-round-input">Palavras por Duelo:</Label>
                    <Input
                        id="words-per-round-input"
                        type="number"
                        min="1"
                        max="5"
                        value={wordsPerRound}
                        onChange={(e) => setWordsPerRound(Math.max(1, parseInt(e.target.value, 10)))}
                        className="w-20"
                        disabled={raffleState !== 'idle'}
                    />
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
                        
                        {isTie ? (
                            <>
                                <ShieldAlert className="w-20 h-20 text-blue-500" />
                                <p className="text-2xl font-bold mt-2">Houve um empate entre:</p>
                                <div className="text-2xl font-bold text-foreground">
                                    {finalWinners.map(winner => (
                                        <div key={winner.id} className="flex items-center gap-2 justify-center">
                                            <span>{winner.name}</span>
                                            <span className="flex items-center gap-1 text-yellow-500 font-bold">
                                                <Star className="w-5 h-5" /> {`x${winner.stars}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : finalWinners.length > 0 ? (
                             <>
                                <Crown className="w-20 h-20 text-yellow-400" />
                                <p className="text-2xl font-bold mt-2">O grande vencedor é</p>
                                <p className="text-4xl font-bold text-foreground">{finalWinners[0]?.name}</p>
                                <p className="flex items-center gap-2 text-yellow-500 font-bold text-lg">
                                    <Star className="w-6 h-6" /> {`x${finalWinners[0]?.stars || 0}`}
                                </p>
                            </>
                        ) : (
                             <>
                                <Trophy className="w-20 h-20 text-muted-foreground" />
                                <p className="text-2xl font-bold mt-2">Fim da Disputa</p>
                                <p className="text-base text-muted-foreground">Não houve vencedores nesta rodada.</p>
                            </>
                        )}
                    </div>
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-center">
                    {isTie ? (
                        <>
                           <AlertDialogAction className="w-full sm:w-auto" onClick={startTieBreaker}>
                                <RefreshCw className="mr-2" /> Iniciar Desempate
                            </AlertDialogAction>
                           <AlertDialogAction className="w-full sm:w-auto" variant="outline" onClick={() => router.push('/')}>Voltar para o Início</AlertDialogAction>
                        </>
                    ) : (
                        <AlertDialogAction className="w-full" onClick={() => router.push('/')}>Voltar para o Início</AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
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

    
