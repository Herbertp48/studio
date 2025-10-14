
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw, PartyPopper, Projector, Eye, ShieldAlert, Swords } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';

export type WordList = {
    id: string;
    name: string;
    words: string[];
}

type RaffleState = 'idle' | 'participants_sorted' | 'word_preview' | 'word_sorted' | 'duel_finished' | 'shuffling';
type SortMode = 'random' | 'sequential';

type DuelState = {
    participantA: Participant;
    participantB: Participant;
    scoreA: number;
    scoreB: number;
    wordsA: string[];
    wordsB: string[];
};

type DisputeStatePayload = {
    participantA?: Participant | null;
    participantB?: Participant | null;
    word?: string | null;
    winner?: Participant | null;
    loser?: Participant | null;
    duelScore?: { a: number, b: number };
    duelWordsWon?: string[];
    finalWinner?: Participant | null;
    activeParticipants?: Participant[];
    tieWinners?: Participant[];
};

type DisputeAction = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'WORD_WINNER' | 'NO_WORD_WINNER' | 'DUEL_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'TIE_ANNOUNCEMENT';
    payload: DisputeStatePayload;
}


const setDisputeState = (state: DisputeAction | { type: 'RESET' } | null) => {
     if (state && state.type !== 'RESET' && !('payload' in state)) {
        set(ref(database, 'dispute/state'), { type: state.type, payload: {} });
    } else {
        set(ref(database, 'dispute/state'), state);
    }
}

const DUEL_TARGET_SCORE = 2;

function RafflePageContent() {
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [participants, setParticipants] = useState<{ [key: string]: Participant }>({});
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  
  const [currentDuel, setCurrentDuel] = useState<DuelState | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [raffleState, setRaffleState] = useState<RaffleState>('idle');
  const [duelWinner, setDuelWinner] = useState<Participant | null>(null);
  const [showFinalWinnerDialog, setShowFinalWinnerDialog] = useState(false);
  const [finalWinners, setFinalWinners] = useState<Participant[]>([]);
  const [isTie, setIsTie] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>('random');
  const [manualReveal, setManualReveal] = useState(false);
  const [originalWords, setOriginalWords] = useState<string[]>([]);
  const shufflingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        
        if (maxStars === 0 && activeParticipants.length === 0) {
             setFinalWinners([]);
             setIsTie(false);
             setShowFinalWinnerDialog(true);
            return;
        }
        
        const winners = allParticipants.filter(p => p.stars === maxStars && p.stars > 0);
        
        if (winners.length > 0) {
            setFinalWinners(winners);
            setIsTie(winners.length > 1);
            setShowFinalWinnerDialog(true);
            if (winners.length === 1) {
                setDisputeState({ type: 'FINAL_WINNER', payload: { finalWinner: winners[0] } });
            } else {
                 setDisputeState({ type: 'TIE_ANNOUNCEMENT', payload: { tieWinners: winners } });
            }
        } else {
            const winner = activeParticipants.length === 1 ? activeParticipants[0] : null;
            if (winner) {
              setFinalWinners([winner]);
              setIsTie(false);
              setShowFinalWinnerDialog(true);
              setDisputeState({ type: 'FINAL_WINNER', payload: { finalWinner: winner } });
            } else {
              setFinalWinners([]);
              setIsTie(false);
              setShowFinalWinnerDialog(true);
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
            if (raffleState === 'idle') {
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
  }, []);

  
  const sortParticipants = () => {
    if (!participants || raffleState === 'shuffling') return;
    
    setDuelWinner(null);
    setCurrentWord(null);
    setDisputeState({ type: 'RESET' });

    let activeParticipants = Object.values(participants).filter(p => !p.eliminated);

    if (activeParticipants.length < 2) {
      toast({ variant: "destructive", title: "Fim da Disputa", description: "Não há participantes ativos suficientes para uma nova rodada." });
      checkForWinner(participants);
      return;
    }

    setRaffleState('shuffling');

    shufflingIntervalRef.current = setInterval(() => {
        const shuffled = [...activeParticipants].sort(() => 0.5 - Math.random());
        setDisputeState({ 
            type: 'SHUFFLING_PARTICIPANTS', 
            payload: {
                activeParticipants,
                participantA: shuffled[0],
                participantB: shuffled[1]
            }
        });
    }, 150);

    setTimeout(() => {
        if (shufflingIntervalRef.current) {
            clearInterval(shufflingIntervalRef.current);
            shufflingIntervalRef.current = null;
        }

        const shuffled = [...activeParticipants].sort(() => 0.5 - Math.random());
        const participantA = shuffled[0];
        const participantB = shuffled[1];

        setCurrentDuel({ participantA, participantB, scoreA: 0, scoreB: 0, wordsA: [], wordsB: [] });
        setRaffleState('participants_sorted');
        setDisputeState({ type: 'UPDATE_PARTICIPANTS', payload: { participantA, participantB, duelScore: { a: 0, b: 0 } } });
    }, 4000);
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
        setDisputeState({ type: 'SHOW_WORD', payload: { word: sortedWord, participantA: currentDuel?.participantA, participantB: currentDuel?.participantB } });
    }
  };

  const revealWord = () => {
    if (!currentWord || !currentDuel) return;
    setRaffleState('word_sorted');
    setDisputeState({ type: 'SHOW_WORD', payload: { word: currentWord, participantA: currentDuel.participantA, participantB: currentDuel.participantB } });
  };
  
  const handleWordWinner = (winnerId: string | null) => {
    if (!currentDuel || !currentWord) return;

    if (winnerId === null) {
        setDisputeState({ type: 'NO_WORD_WINNER', payload: { word: currentWord, participantA: currentDuel.participantA, participantB: currentDuel.participantB, duelScore: { a: currentDuel.scoreA, b: currentDuel.scoreB } } });
        setCurrentWord(null);
        setRaffleState('participants_sorted');
        return;
    }

    const isParticipantA = winnerId === currentDuel.participantA.id;
    const newScoreA = isParticipantA ? currentDuel.scoreA + 1 : currentDuel.scoreA;
    const newScoreB = !isParticipantA ? currentDuel.scoreB + 1 : currentDuel.scoreB;
    const newWordsA = isParticipantA ? [...currentDuel.wordsA, currentWord] : currentDuel.wordsA;
    const newWordsB = !isParticipantA ? [...currentDuel.wordsB, currentWord] : currentDuel.wordsB;
    
    const updatedDuelState: DuelState = {
        ...currentDuel,
        scoreA: newScoreA,
        scoreB: newScoreB,
        wordsA: newWordsA,
        wordsB: newWordsB
    };

    setCurrentDuel(updatedDuelState);
    setCurrentWord(null);

    const winner = isParticipantA ? currentDuel.participantA : currentDuel.participantB;

    setDisputeState({
        type: 'WORD_WINNER',
        payload: {
            winner,
            word: currentWord,
            participantA: currentDuel.participantA,
            participantB: currentDuel.participantB,
            duelScore: { a: newScoreA, b: newScoreB }
        }
    });

    handleDuelResult(updatedDuelState);
  };
  
  const handleDuelResult = (duelState: DuelState) => {
     if (duelState.scoreA >= DUEL_TARGET_SCORE || duelState.scoreB >= DUEL_TARGET_SCORE) {
        finishDuel(duelState);
     } else {
        setRaffleState('participants_sorted');
     }
  }

  const finishDuel = (duelState: DuelState) => {
    const winner = duelState.scoreA > duelState.scoreB ? duelState.participantA : duelState.participantB;
    const duelWordsWon = duelState.scoreA > duelState.scoreB ? duelState.wordsA : duelState.wordsB;

    setDuelWinner(winner);
    setRaffleState('duel_finished');
    
    setDisputeState({ 
        type: 'DUEL_WINNER', 
        payload: {
            winner,
            loser: duelState.scoreA > duelState.scoreB ? duelState.participantB : duelState.participantA,
            duelWordsWon
        }
    });

    toast({
        title: "Duelo Encerrado!",
        description: `${winner.name} venceu o duelo e ganhou uma estrela!`,
    });
  }

  const nextRound = async () => {
    if (!duelWinner || !currentDuel) return;
    
    const loser = currentDuel.participantA.id === duelWinner.id ? currentDuel.participantB : currentDuel.participantA;

    const newWinnerEntryRef = push(ref(database, 'winners'));
    await set(newWinnerEntryRef, {
        name: duelWinner.name,
        word: 'Duelo Vencido',
        stars: 1 
    });

    const updates: { [key: string]: any } = {};
    updates[`/dispute/participants/${duelWinner.id}/stars`] = (duelWinner.stars || 0) + 1;
    updates[`/dispute/participants/${loser.id}/eliminated`] = true;
    
    await update(ref(database), updates);

    setCurrentDuel(null);
    setCurrentWord(null);
    setDuelWinner(null);
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

        setRaffleState('idle');
        setDisputeState({ type: 'RESET' });
        toast({ title: "Desempate!", description: "A rodada de desempate começou." });
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

    if (raffleState === 'participants_sorted' && currentDuel) {
      return (
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-primary">Duelo em Andamento!</h2>
          <div className="flex items-center justify-around gap-4 text-2xl font-semibold w-full">
              <div className="flex flex-col items-center gap-2">
                <span className="line-clamp-1">{currentDuel.participantA.name}</span>
                <span className="text-4xl font-bold">{currentDuel.scoreA}</span>
              </div>
              <Swords className="text-muted-foreground w-10 h-10"/>
              <div className="flex flex-col items-center gap-2">
                <span className="line-clamp-1">{currentDuel.participantB.name}</span>
                 <span className="text-4xl font-bold">{currentDuel.scoreB}</span>
              </div>
          </div>
           <Progress value={(currentDuel.scoreA + currentDuel.scoreB) / (DUEL_TARGET_SCORE * 2) * 100} className="w-[60%]"/>
          <Button size="lg" onClick={sortWord} className="mt-4">
            <PartyPopper className="mr-2"/>Sortear Próxima Palavra
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
            <p className="text-xl font-semibold mt-4">Quem acertou a palavra?</p>
            <div className="flex justify-center gap-4 flex-wrap">
                <Button variant="outline" size="lg" onClick={() => handleWordWinner(currentDuel.participantA.id)}>
                    <Star className="mr-2"/> {currentDuel.participantA.name}
                </Button>
                <Button variant="outline" size="lg" onClick={() => handleWordWinner(currentDuel.participantB.id)}>
                    <Star className="mr-2"/> {currentDuel.participantB.name}
                </Button>
                <Button variant="secondary" size="lg" onClick={() => handleWordWinner(null)}>
                    Ninguém acertou
                </Button>
            </div>
        </div>
      )
    }

    if (raffleState === 'duel_finished' && duelWinner) {
      return (
        <div className="text-center flex flex-col items-center gap-6">
            <h2 className="text-3xl font-bold">Duelo Encerrado!</h2>
            <p className="text-2xl text-amber-500 flex items-center justify-center gap-2">
                <Trophy /> {duelWinner.name} venceu! <Star /> 
            </p>
            <p className="text-muted-foreground">{Object.values(participants).filter(p => !p.eliminated).length} participantes restantes</p>
            <Button size="lg" onClick={nextRound}><RefreshCw className="mr-2" />Próxima Rodada</Button>
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

    