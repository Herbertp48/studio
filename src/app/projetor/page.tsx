
'use client';

import { useState, useEffect, useRef } from 'react';
import type { Participant } from '@/app/page';
import { Crown, Star, Trophy, ShieldAlert, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { AggregatedWinner } from '@/app/ganhadores/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AnimatePresence, motion } from 'framer-motion';

type DisputeStatePayload = {
    participantA?: Participant | null;
    participantB?: Participant | null;
    word?: string | null;
    words?: string[];
    winner?: Participant | null;
    loser?: Participant | null;
    duelScore?: { a: number, b: number };
    duelWordsWon?: string[];
    finalWinner?: Participant | null;
    activeParticipants?: Participant[];
    winners?: AggregatedWinner[];
    tieWinners?: Participant[];
};

type DisputeAction = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'WORD_WINNER' | 'DUEL_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'SHOW_WINNERS' | 'TIE_ANNOUNCEMENT' | 'NO_WORD_WINNER' | 'NO_WINNER';
    payload: DisputeStatePayload;
}


type DisplayState = {
    view: 'idle' | 'shuffling' | 'duel' | 'message';
    message: {
        type: 'word_winner' | 'no_word_winner' | 'duel_winner' | 'final_winner' | 'tie_announcement' | 'winners_table' | 'no_winner' | null;
        data: any;
    };
    duelState: {
        participantA: Participant | null;
        participantB: Participant | null;
        word: string | null;
        showWord: boolean;
        duelScore: { a: number, b: number };
    }
};

const initialDisplayState: DisplayState = {
    view: 'idle',
    message: { type: null, data: null },
    duelState: {
        participantA: null,
        participantB: null,
        word: null,
        showWord: false,
        duelScore: { a: 0, b: 0 }
    }
};

export default function ProjectionPage() {
    const [isMounted, setIsMounted] = useState(false);
    const [displayState, setDisplayState] = useState<DisplayState>(initialDisplayState);
    const sounds = useRef<{ [key: string]: HTMLAudioElement }>({});
    const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentDuelStateRef = useRef(initialDisplayState.duelState);

    useEffect(() => {
        setIsMounted(true);
        const soundFiles = ['tambor.mp3', 'sinos.mp3', 'premio.mp3', 'vencedor.mp3'];
        soundFiles.forEach(file => {
            if (!sounds.current[file]) {
                const audio = new Audio(`/som/${file}`);
                audio.load();
                sounds.current[file] = audio;
            }
        });
        
        return () => {
             Object.values(sounds.current).forEach(sound => {
                if (sound && !sound.paused) {
                    sound.pause();
                    sound.currentTime = 0;
                }
            });
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const stopAllSounds = () => {
            Object.values(sounds.current).forEach(sound => {
                if (sound && !sound.paused) sound.pause();
            });
        };

        const playSound = (soundFile: string, loop = false) => {
            stopAllSounds();
            const soundToPlay = sounds.current[soundFile];
            if (soundToPlay) {
                soundToPlay.loop = loop;
                soundToPlay.play().catch(e => {
                  if (e.name !== 'AbortError') console.error("Erro ao tocar áudio:", e)
                });
            }
        };

        
        const processAction = (action: DisputeAction) => {
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);

            switch (action.type) {
                case 'RESET':
                    stopAllSounds();
                    setDisplayState(initialDisplayState);
                    currentDuelStateRef.current = initialDisplayState.duelState;
                    break;
                
                case 'SHUFFLING_PARTICIPANTS':
                     if (displayState.view !== 'shuffling') {
                         playSound('tambor.mp3', true);
                     }
                     setDisplayState(prevState => ({
                         ...prevState,
                         view: 'shuffling',
                         duelState: {
                             ...initialDisplayState.duelState,
                             participantA: action.payload.participantA || null,
                             participantB: action.payload.participantB || null,
                         }
                     }));
                    break;

                case 'UPDATE_PARTICIPANTS':
                    stopAllSounds();
                    playSound('sinos.mp3');
                    const newDuelState = {
                        ...initialDisplayState.duelState,
                        participantA: action.payload.participantA || null,
                        participantB: action.payload.participantB || null,
                        duelScore: action.payload.duelScore || { a: 0, b: 0 },
                    };
                    setDisplayState({ ...initialDisplayState, view: 'duel', duelState: newDuelState });
                    currentDuelStateRef.current = newDuelState;
                    break;

                case 'SHOW_WORD':
                    playSound('premio.mp3');
                    setDisplayState(prevState => {
                        const updatedDuelState = { ...prevState.duelState, word: action.payload.word || (action.payload.words ? action.payload.words[0] : null), showWord: true };
                        currentDuelStateRef.current = updatedDuelState;
                        return { ...prevState, duelState: updatedDuelState };
                    });
                    break;
                
                case 'WORD_WINNER':
                case 'NO_WORD_WINNER':
                    playSound('vencedor.mp3');
                     if (action.payload.duelScore) {
                        currentDuelStateRef.current = {
                            ...currentDuelStateRef.current,
                            duelScore: action.payload.duelScore,
                        };
                    }
                    setDisplayState(prevState => ({
                        ...prevState,
                        view: 'message',
                        message: { type: action.type, data: action.payload }
                    }));
                     messageTimeoutRef.current = setTimeout(() => {
                        setDisplayState({
                           ...initialDisplayState,
                           view: 'duel',
                           duelState: currentDuelStateRef.current
                        });
                    }, 4000);
                    break;
                
                case 'DUEL_WINNER':
                     playSound('vencedor.mp3');
                     setDisplayState(prevState => ({
                        ...prevState,
                        view: 'message',
                        message: { type: action.type, data: action.payload }
                    }));
                    // Don't set a timeout, wait for a RESET from the controller
                    break;

                case 'FINAL_WINNER':
                case 'TIE_ANNOUNCEMENT':
                case 'SHOW_WINNERS':
                case 'NO_WINNER':
                    stopAllSounds();
                    playSound('vencedor.mp3');
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'message',
                        message: { type: action.type, data: action.payload }
                    });
                    break;
            }
        }

        const disputeStateRef = ref(database, 'dispute/state');
        const unsubscribe = onValue(disputeStateRef, (snapshot) => {
            const action: DisputeAction | null = snapshot.val();
            if (action && action.type) {
                processAction(action);
            } else if(displayState.view !== 'idle') {
                 processAction({ type: 'RESET', payload: {} });
            }
        });

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMounted]);

    if (!isMounted) return null;

    const renderDuelContent = () => (
        <div className="flex flex-col items-center justify-start pt-8 w-full h-full">
            <header className="flex items-center gap-4 text-accent">
                <h1 className="text-8xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                <Image src="/images/Bee.gif" alt="Bee Icon" width={100} height={100} unoptimized />
            </header>
            
            <div className="relative mt-8 text-center text-white w-full flex-1 flex flex-col justify-center items-center">
                <div className={cn("absolute top-0 left-0 right-0 flex flex-col items-center transition-opacity duration-300 z-10 w-full", displayState.duelState.showWord ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                    <h2 className="text-6xl font-bold text-accent font-melison">The Word Is</h2>
                    <div className="mt-4 h-32 flex items-center justify-center bg-accent text-accent-foreground rounded-2xl w-full max-w-2xl">
                        <p className="text-5xl font-bold uppercase tracking-[0.2em] break-all px-4 font-subjectivity">{displayState.duelState.word || '...'}</p>
                    </div>
                </div>
                
                <div className="relative w-full flex-1 flex items-center justify-center">
                    <div className="grid grid-cols-12 items-center w-full gap-4">
                        <div className="col-start-1 col-span-5 text-center flex flex-col items-center gap-4">
                            <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.duelState.participantA?.name || 'Participante A'}</h3>
                            <span className="text-6xl font-bold text-white">{displayState.duelState.duelScore.a}</span>
                        </div>
                        <div className="col-span-2 text-center">
                            <Swords className="text-8xl font-bold font-melison w-32 h-32 text-accent"/>
                        </div>
                        <div className="col-span-5 text-center flex flex-col items-center gap-4">
                            <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.duelState.participantB?.name || 'Participante B'}</h3>
                             <span className="text-6xl font-bold text-white">{displayState.duelState.duelScore.b}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const ShufflingView = () => (
        <div className="flex flex-col items-center justify-center pt-8 w-full h-full">
            <header className="flex items-center gap-4 text-accent mb-8">
                <h1 className="text-8xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                <Image src="/images/Bee.gif" alt="Bee Icon" width={100} height={100} unoptimized />
            </header>
            <div className="grid grid-cols-12 items-center w-full gap-4">
                <div className="col-start-2 col-span-4 text-center">
                    <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.duelState.participantA?.name || '...'}</h3>
                </div>
                <div className="col-span-2 text-center">
                    <h3 className="text-8xl font-bold font-melison">Vs.</h3>
                </div>
                <div className="col-span-4 text-center">
                    <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.duelState.participantB?.name || '...'}</h3>
                </div>
            </div>
        </div>
    );

    const MessageView = () => {
        const { type, data } = displayState.message;
        if (!type || !data) return null;

        const getWinnerName = () => {
             if (data.winner) return data.winner.name;
             if (data.finalWinner) return data.finalWinner.name;
             return 'Vencedor';
        }

        const getWord = () => {
             if(data.word) return data.word;
             if(data.words && data.words.length > 0) return data.words[0];
             return '';
        }
        
        if (type === 'word_winner') {
            return (
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                     <p className="text-5xl leading-tight font-semibold">
                        <b className="text-white bg-accent-foreground px-4 py-2 rounded-lg shadow-md mx-2 uppercase inline-block max-w-full break-words">{getWinnerName()}</b>
                        <br/>
                        acertou a palavra e marcou 1 ponto!
                    </p>
                </div>
            )
        }

        if (type === 'no_word_winner') {
             return (
                <div className="bg-stone-50 text-accent-foreground border-8 border-red-500 rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                     <p className="text-5xl leading-tight font-semibold">
                        Ninguém acertou a palavra
                         <br/> 
                        <b className="text-white bg-red-600 px-4 py-2 rounded-lg shadow-md mx-2 uppercase inline-block max-w-full break-words">{getWord()}</b>
                    </p>
                </div>
            )
        }
        
        if (type === 'duel_winner') {
             const words = data.duelWordsWon?.join(', ');
             return (
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                     <div className="text-6xl mb-6 inline-block">
                        <b className="text-white bg-accent-foreground px-8 py-4 rounded-lg inline-block shadow-lg max-w-full break-words">{getWinnerName()}</b>
                    </div>
                     <p className="text-5xl leading-tight font-semibold">
                        Ganhou o duelo soletrando:
                         <br/> 
                        <i className="text-white bg-accent-foreground px-4 py-2 rounded-lg shadow-md mx-2 inline-block max-w-full break-words text-4xl">{words}</i>
                        <br/> 
                        e recebeu uma estrela <Star className="inline-block w-16 h-16 text-accent fill-accent" /> !
                    </p>
                </div>
            );
        }

        if (type === 'final_winner') {
            return (
                <div className="bg-gradient-to-br from-yellow-300 to-amber-500 text-purple-900 border-8 border-white rounded-3xl p-20 shadow-2xl text-center max-w-5xl mx-auto relative overflow-hidden font-subjectivity">
                    <Crown className="absolute -top-16 -left-16 w-64 h-64 text-white/20 -rotate-12" />
                    <Crown className="absolute -bottom-20 -right-16 w-72 h-72 text-white/20 rotate-12" />
                    <h2 className="text-6xl font-black uppercase tracking-wider font-melison">Temos um Vencedor!</h2>
                    <Crown className="w-48 h-48 mx-auto my-8 text-white drop-shadow-lg" />
                    <p className="text-8xl font-black tracking-wide text-white bg-purple-800/80 px-8 py-4 rounded-xl shadow-inner font-melison">{getWinnerName()}</p>
                    <p className="mt-8 text-5xl font-bold flex items-center justify-center gap-4">
                        Com {data.finalWinner.stars} <Star className="w-12 h-12 text-white" />
                    </p>
                </div>
            )
        }

        if (type === 'tie_announcement') {
            return (
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                    <ShieldAlert className="w-32 h-32 mx-auto text-accent mb-6" />
                    <h2 className="text-7xl font-bold font-melison mb-4">Temos um Empate!</h2>
                    <p className="text-3xl mb-6">Os seguintes participantes irão para a rodada de desempate:</p>
                    <div className="text-4xl font-bold space-y-2">
                        {data.tieWinners.map((winner: Participant) => (
                            <p key={winner.id} className="text-white bg-accent-foreground px-6 py-2 rounded-lg shadow-md max-w-full break-words">{winner.name}</p>
                        ))}
                    </div>
                </div>
            );
        }

        if (type === 'winners_table') {
            const winners = (data.winners || []).sort((a: AggregatedWinner, b: AggregatedWinner) => b.totalStars - a.totalStars);
            return (
                 <div className="w-full max-w-6xl">
                    <h1 className="text-8xl font-melison font-bold tracking-tight text-accent mb-8 flex items-center gap-4 justify-center">
                        <Trophy className="w-20 h-20" /> Classificação Final
                    </h1>
                    <div className="w-full bg-stone-50/90 rounded-2xl shadow-2xl p-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-0">
                                    <TableHead className="w-1/2 text-center text-accent-foreground font-bold text-5xl font-melison py-4">Nome</TableHead>
                                    <TableHead className="w-1/2 text-center text-accent-foreground font-bold text-5xl font-melison py-4">Estrelas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {winners.map((winner: AggregatedWinner) => (
                                    <TableRow key={winner.name} className="border-t-4 border-amber-300">
                                    <TableCell className="font-bold text-accent-foreground text-center text-4xl p-6 font-subjectivity">
                                        {winner.name}
                                    </TableCell>
                                    <TableCell className="text-center p-6">
                                        <div className="flex items-center justify-center gap-2">
                                        {Array.from({ length: winner.totalStars }).map((_, i) => (
                                            <Star key={i} className="w-10 h-10 text-yellow-400 fill-yellow-400" />
                                        ))}
                                        </div>
                                    </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )
        }

        if (type === 'no_winner') {
             return (
                <div className="bg-stone-50 text-accent-foreground border-8 border-red-500 rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                    <Trophy className="w-32 h-32 mx-auto text-red-500 mb-6" />
                     <p className="text-5xl leading-tight font-semibold">
                        Fim da disputa.
                        <br />
                        Não houve vencedores.
                    </p>
                </div>
            )
        }
        
        return null;
    }


    const renderContent = () => {
        if (displayState.view === 'message') {
            return (
                 <AnimatePresence>
                    <motion.div
                        className="fixed inset-0 flex flex-col items-center justify-center p-8 z-20"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.5 }}
                    >
                         <MessageView />
                    </motion.div>
                </AnimatePresence>
            )
        }
        
        if (displayState.view === 'shuffling') {
            return <ShufflingView />;
        }

        if (displayState.view === 'duel') {
            return renderDuelContent();
        }

        return (
            <div className="flex flex-col items-center justify-start pt-8 w-full h-full">
                <header className="flex items-center gap-4 text-accent">
                    <h1 className="text-8xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                    <Image src="/images/Bee.gif" alt="Bee Icon" width={100} height={100} unoptimized />
                </header>
                 <p className="mt-8 text-4xl text-accent font-subjectivity">Aguardando início da disputa...</p>
            </div>
        );
    }

    return (
        <div className="projetado-page h-screen w-screen overflow-hidden relative">
            {renderContent()}
        </div>
    );
}

    

    