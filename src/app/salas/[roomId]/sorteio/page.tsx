'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import type { Participant } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dices, Trophy, Crown, Star, RefreshCw, PartyPopper, Projector, Eye, ShieldAlert, Users, ArrowLeft } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export type WordList = {
    id: string;
    name: string;
    words: string[];
}

type RaffleState = 'idle' | 'participants_sorted' | 'word_preview' | 'word_sorted' | 'word_finished' | 'duel_finished' | 'shuffling' | 'game_over';
type SortMode = 'random' | 'sequential';
type DisputeState = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'WORD_WINNER' | 'DUEL_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'TIE_ANNOUNCEMENT' | 'NO_WINNER' | 'NO_WORD_WINNER' | 'SHOW_MESSAGE';
    payload?: any;
}

function RoomSorteioPageContent() {
  const params = useParams();
  const roomId = params.roomId as string;
  
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
  const [wordsPerRound, setWordsPerRound] = useState(1);
  const [wordsPlayed, setWordsPlayed] = useState(0);
  const [duelScore, setDuelScore] = useState({ a: 0, b: 0 });
  const [duelWordsWon, setDuelWordsWon] = useState<{a: string[], b: string[]}>({a: [], b: []});
  const [playedInRound, setPlayedInRound] = useState<string[]>([]);

  const { toast } = useToast();
  const router = useRouter();

  const participantsList = Object.values(participants).sort((a, b) => b.stars - a.stars);
  const activeParticipants = participantsList.filter(p => !p.eliminated);
  const duelsInRoundTotal = Math.floor(activeParticipants.length / 2);
  const duelsInRoundPlayed = Math.floor(playedInRound.length / 2);

  // Set dispute state for room-specific path
  const setRoomDisputeState = (state: DisputeState | null) => {
      set(ref(database, `rooms/${roomId}/dispute/state`), state);
  }

  const checkForWinner = (currentParticipants: { [key: string]: Participant }) => {
      if (!currentParticipants || Object.keys(currentParticipants).length === 0) return false;
  
      const activeParticipants = Object.values(currentParticipants).filter(p => !p.eliminated);
  
      if (activeParticipants.length < 2) {
          const allParticipants = Object.values(currentParticipants);
          const maxStars = Math.max(0, ...allParticipants.map(p => p.stars));
          
          if (maxStars === 0 && allParticipants.every(p => p.stars === 0)) {
              setFinalWinners([]);
              setIsTie(false);
              setRoomDisputeState({ type: 'NO_WINNER' });
          } else {
              const potentialWinners = allParticipants.filter(p => p.stars === maxStars);
              
              if (potentialWinners.length > 1) {
                  setFinalWinners(potentialWinners);
                  setIsTie(true);
                  setRoomDisputeState({ type: 'TIE_ANNOUNCEMENT', payload: { participants: potentialWinners } });
              } else {
                  setFinalWinners([potentialWinners[0]]);
                  setIsTie(false);
                  setRoomDisputeState({ type: 'FINAL_WINNER', payload: { winner: potentialWinners[0] } });
              }
          }
          setShowFinalWinnerDialog(true);
          setRaffleState('game_over');
          return true;
      }
      return false;
  }

  useEffect(() => {
      const disputeRef = ref(database, `rooms/${roomId}/dispute`);
      const unsubscribe = onValue(disputeRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
              setParticipants(data.participants || {});
              if (!checkForWinner(data.participants || {})) {
                  if (data.state) {
                      if (data.state.type === 'SHOW_WORD') {
                          setCurrentWords(data.state.payload?.words);
                          setRaffleState('word_sorted');
                      } else if (data.state.type === 'HIDE_WORD') {
                          setRaffleState('word_finished');
                      } else if (data.state.type === 'WORD_WINNER') {
                          handleWordWinner(data.state.payload.winner, data.state.payload.words);
                      } else if (data.state.type === 'DUEL_WINNER') {
                          handleDuelWinner(data.state.payload.winner, data.state.payload.loser);
                      } else if (data.state.type === 'UPDATE_PARTICIPANTS') {
                          setRaffleState('participants_sorted');
                          setCurrentDuel(null);
                      } else if (data.state.type === 'SHUFFLING_PARTICIPANTS') {
                          setRaffleState('shuffling');
                      }
                  }
              }
          }
      });

      const wordListsRef = ref(database, `rooms/${roomId}/wordlists`);
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
              setWordLists([]);
          }
      });

      return () => {
          unsubscribe();
          unsubscribeWordLists();
      };
  }, [roomId]);

  const handleWordWinner = (winner: Participant, words: string[]) => {
      setDuelScore(prev => ({
          ...prev,
          [winner.id === currentDuel?.participantA.id ? 'a' : 'b']: prev[winner.id === currentDuel?.participantA.id ? 'a' : 'b'] + 1
      }));
      
      const winnerSide = winner.id === currentDuel?.participantA.id ? 'a' : 'b';
      setDuelWordsWon(prev => ({
          ...prev,
          [winnerSide]: [...prev[winnerSide], ...words]
      }));
      
      setWordsPlayed(prev => prev + 1);
      setPlayedInRound(prev => [...prev, winner.id]);
      setRaffleState('word_finished');
  }

  const handleDuelWinner = (duelWinner: Participant, duelLoser: Participant) => {
      const newStars = duelWinner.stars + 1;
      const updates: { [key: string]: any } = {};
      updates[`/rooms/${roomId}/dispute/participants/${duelWinner.id}/stars`] = newStars;
      updates[`/rooms/${roomId}/dispute/participants/${duelLoser.id}/eliminated`] = true;
      
      update(ref(database), updates).then(() => {
          setDuelScore({ a: 0, b: 0 });
          setDuelWordsWon({ a: [], b: [] });
          setWordsPlayed(0);
          setCurrentDuel(null);
          setPlayedInRound(prev => prev.filter(id => id !== duelWinner.id && id !== duelLoser.id));
          setRaffleState('duel_finished');
          toast({ title: 'Fim da Batalha!', description: `${duelWinner.name} venceu e ganhou uma estrela!` });
      });
  }

  const startNextDuel = async () => {
      if (playedInRound.length >= activeParticipants.length) {
          setPlayedInRound([]);
          setRaffleState('shuffling');
          setTimeout(() => setRaffleState('participants_sorted'), 1000);
          return;
      }

      const availableForDuel = activeParticipants.filter(p => !playedInRound.includes(p.id));
      
      if (availableForDuel.length < 2) {
          if (availableForDuel.length === 1) {
              setPlayedInRound(prev => [...prev, availableForDuel[0].id]);
              toast({ description: `${availableForDuel[0].name} passa automaticamente para a próxima rodada!` });
          }
          setRaffleState('shuffling');
          setTimeout(() => setRaffleState('participants_sorted'), 1000);
          return;
      }

      let shuffled = [...availableForDuel];
      if (sortMode === 'random') {
          shuffled = shuffled.sort(() => Math.random() - 0.5);
      }

      const participantA = shuffled[0];
      const participantB = shuffled[1];

      setCurrentDuel({ participantA, participantB });
      setDuelScore({ a: 0, b: 0 });
      setDuelWordsWon({ a: [], b: [] });
      setWordsPlayed(0);

      let currentAvailableWords = [...availableWords];
      if (currentAvailableWords.length < wordsPerRound * 3) {
          const allWords = wordLists.flatMap(wl => wl.words);
          currentAvailableWords = allWords.sort(() => Math.random() - 0.5);
          setAvailableWords(currentAvailableWords);
          set(ref(database, `rooms/${roomId}/dispute/words`), currentAvailableWords);
      }

      const selectedWords = currentAvailableWords.slice(0, wordsPerRound);
      setOriginalWords(selectedWords);
      
      if (manualReveal) {
          setCurrentWords(selectedWords);
          setRaffleState('word_preview');
      } else {
          setRoomDisputeState({ type: 'SHOW_WORD', payload: { words: selectedWords } });
      }
  }

  const handleRevealWord = () => {
      if (currentWords) {
          setRoomDisputeState({ type: 'SHOW_WORD', payload: { words: currentWords } });
      }
  }

  const handleHideWord = () => {
      setRoomDisputeState({ type: 'HIDE_WORD' });
  }

  const handleRegisterStar = (participant: Participant) => {
      if (!currentDuel || !currentWords) return;
      
      const isPlayerA = participant.id === currentDuel.participantA.id;
      const otherParticipant = isPlayerA ? currentDuel.participantB : currentDuel.participantA;
      
      setRoomDisputeState({ 
          type: 'WORD_WINNER', 
          payload: { 
              winner: participant, 
              loser: otherParticipant,
              words: currentWords 
          } 
      });
  }

  const handleDuelEnd = () => {
      if (!currentDuel) return;
      
      if (duelScore.a > duelScore.b) {
          handleDuelWinner(currentDuel.participantA, currentDuel.participantB);
      } else if (duelScore.b > duelScore.a) {
          handleDuelWinner(currentDuel.participantB, currentDuel.participantA);
      } else {
          toast({ description: 'Empate nesta batalha! Ninguém ganha estrela.' });
          setDuelScore({ a: 0, b: 0 });
          setDuelWordsWon({ a: [], b: [] });
          setWordsPlayed(0);
          setCurrentDuel(null);
          setPlayedInRound(prev => [...prev, currentDuel.participantA.id, currentDuel.participantB.id]);
          setRaffleState('duel_finished');
      }
  }

  const resetDispute = () => {
      set(ref(database, `rooms/${roomId}/dispute`), {
          participants: participants,
          state: null
      });
      setRaffleState('idle');
      setCurrentDuel(null);
      setPlayedInRound([]);
      toast({ title: 'Disputa reiniciada!' });
  }

  const goToProjector = () => {
      router.push(`/salas/${roomId}/projetor`);
  }

  return (
    <ProtectedRoute>
      <div className="flex flex-col w-full bg-background text-foreground min-h-screen">
        <AppHeader />
        <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={() => router.push(`/salas/${roomId}`)} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Disputa - Sala {roomId}</h1>
                <p className="text-muted-foreground">Gerencie a disputa em tempo real</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={goToProjector} variant="outline">
                <Projector className="mr-2 h-4 w-4" /> Projetor
              </Button>
              <Button onClick={resetDispute} variant="destructive">
                <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" /> Participantes Ativos
                  </CardTitle>
                  <CardDescription>{activeParticipants.length} participantes na disputa</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {participantsList.map((participant) => (
                      <Card key={participant.id} className={participant.eliminated ? 'opacity-50' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {participant.eliminated ? (
                                <ShieldAlert className="h-4 w-4 text-destructive" />
                              ) : (
                                <Crown className="h-4 w-4 text-primary" />
                              )}
                              <span className="font-medium">{participant.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-bold">{participant.stars}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {currentDuel && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Dices className="h-5 w-5" /> Batalha Atual
                    </CardTitle>
                    <CardDescription>
                      Palavra{wordsPerRound > 1 ? 's' : ''}: {wordsPlayed}/{wordsPerRound} | 
                      Placar: {currentDuel.participantA.name} {duelScore.a} - {duelScore.b} {currentDuel.participantB.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card className={duelScore.a > duelScore.b ? 'border-primary border-2' : ''}>
                        <CardContent className="p-4 text-center">
                          <h3 className="font-bold text-lg">{currentDuel.participantA.name}</h3>
                          <div className="flex justify-center items-center gap-2 mt-2">
                            {Array.from({ length: duelScore.a }).map((_, i) => (
                              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            Palavras ganhas: {duelWordsWon.a.length}
                          </div>
                          {raffleState === 'word_preview' && (
                            <Button 
                              onClick={() => handleRegisterStar(currentDuel.participantA)} 
                              className="mt-2 w-full"
                              disabled={wordsPlayed === 0}
                            >
                              Registrar Vitória
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                      
                      <Card className={duelScore.b > duelScore.a ? 'border-primary border-2' : ''}>
                        <CardContent className="p-4 text-center">
                          <h3 className="font-bold text-lg">{currentDuel.participantB.name}</h3>
                          <div className="flex justify-center items-center gap-2 mt-2">
                            {Array.from({ length: duelScore.b }).map((_, i) => (
                              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            Palavras ganhas: {duelWordsWon.b.length}
                          </div>
                          {raffleState === 'word_preview' && (
                            <Button 
                              onClick={() => handleRegisterStar(currentDuel.participantB)} 
                              className="mt-2 w-full"
                              disabled={wordsPlayed === 0}
                            >
                              Registrar Vitória
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {currentWords && (
                      <Card className="bg-muted">
                        <CardContent className="p-6 text-center">
                          <h3 className="text-sm text-muted-foreground mb-2">Palavra{currentWords.length > 1 ? 's' : ''}</h3>
                          <div className="text-3xl font-bold mb-4">
                            {currentWords.join(', ')}
                          </div>
                          {manualReveal && raffleState === 'word_preview' && (
                            <Button onClick={handleRevealWord} className="mr-2">
                              <Eye className="mr-2 h-4 w-4" /> Revelar
                            </Button>
                          )}
                          {raffleState === 'word_sorted' && (
                            <Button onClick={handleHideWord} variant="outline">
                              Esconder Palavra
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    <div className="flex gap-2">
                      {raffleState === 'word_finished' && (
                        <Button onClick={startNextDuel} className="flex-1">
                          Próxima Palavra
                        </Button>
                      )}
                      {raffleState === 'duel_finished' && (
                        <Button onClick={startNextDuel} className="flex-1">
                          Próxima Batalha
                        </Button>
                      )}
                      {raffleState === 'participants_sorted' && !currentDuel && (
                        <Button onClick={startNextDuel} className="flex-1">
                          Iniciar Batalha
                        </Button>
                      )}
                      {raffleState === 'shuffling' && (
                        <Button disabled className="flex-1">
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Embaralhando...
                        </Button>
                      )}
                      {duelScore.a !== duelScore.b && wordsPlayed > 0 && raffleState === 'word_finished' && (
                        <Button onClick={handleDuelEnd} variant="destructive" className="flex-1">
                          Finalizar Batalha
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Modo de Sorteio</Label>
                    <RadioGroup value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)} className="mt-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="random" id="random" />
                        <Label htmlFor="random">Aleatório</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sequential" id="sequential" />
                        <Label htmlFor="sequential">Sequencial</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="manual-reveal">Revelação Manual</Label>
                    <Switch
                      id="manual-reveal"
                      checked={manualReveal}
                      onCheckedChange={setManualReveal}
                    />
                  </div>

                  <div>
                    <Label htmlFor="words-per-round">Palavras por Rodada</Label>
                    <Select value={wordsPerRound.toString()} onValueChange={(v) => setWordsPerRound(parseInt(v))}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Lista de Palavras</Label>
                    <ScrollArea className="h-32 mt-2">
                      <div className="space-y-2">
                        {wordLists.map(list => (
                          <Badge key={list.id} variant="secondary" className="w-full justify-start">
                            {list.name} ({list.words.length})
                          </Badge>
                        ))}
                        {wordLists.length === 0 && (
                          <p className="text-sm text-muted-foreground">Nenhuma lista carregada</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estado:</span>
                      <Badge>{raffleState}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rodadas:</span>
                      <span>{duelsInRoundPlayed}/{duelsInRoundTotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Participantes:</span>
                      <span>{activeParticipants.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <AlertDialog open={showFinalWinnerDialog} onOpenChange={setShowFinalWinnerDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <PartyPopper className="h-6 w-6 text-yellow-500" />
                {isTie ? 'Empate!' : 'Temos um Vencedor!'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center py-4">
                {isTie ? (
                  <>
                    <p className="text-lg mb-2">Os vencedores são:</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {finalWinners.map(winner => (
                        <Badge key={winner.id} variant="default" className="text-lg px-4 py-2">
                          <Crown className="mr-2 h-4 w-4" /> {winner.name}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : finalWinners.length === 0 ? (
                  <p className="text-lg">Não houve vencedor nesta rodada.</p>
                ) : (
                  <>
                    <p className="text-lg mb-2">O grande campeão é:</p>
                    <Badge variant="default" className="text-xl px-6 py-3">
                      <Crown className="mr-2 h-6 w-6" /> {finalWinners[0].name}
                    </Badge>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => router.push(`/salas/${roomId}`)}>
                Voltar à Sala
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}

export default function RoomSorteioPage() {
  return <RoomSorteioPageContent />;
}
