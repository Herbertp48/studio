'use client';

import { useState, useEffect, useRef } from 'react';
import type { Participant } from '@/app/page';
import { Crown, Star, Trophy, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { AggregatedWinner } from '@/app/ganhadores/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DisputeAction = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'ROUND_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'SHOW_WINNERS' | 'TIE_ANNOUNCEMENT';
    participantA?: Participant | null;
    participantB?: Participant | null;
    word?: string | null;
    winner?: Participant | null;
    loser?: Participant | null;
    finalWinner?: Participant | null;
    activeParticipants?: Participant[];
    winners?: AggregatedWinner[];
    tieWinners?: Participant[];
}

type DisplayState = {
    view: 'main' | 'round_winner' | 'final_winner' | 'shuffling' | 'winners_table' | 'tie_announcement';
    participantA: Participant | null;
    participantB: Participant | null;
    word: string | null;
    showWord: boolean;
    roundWinner?: { winner: Participant, loser: Participant, word: string };
    finalWinner?: Participant;
    winners?: AggregatedWinner[];
    tieWinners?: Participant[];
};

const initialDisplayState: DisplayState = {
    view: 'main',
    participantA: null,
    participantB: null,
    word: null,
    showWord: false,
};

export default function ProjectionPage() {
    const [isMounted, setIsMounted] = useState(false);
    const [displayState, setDisplayState] = useState<DisplayState>(initialDisplayState);
    const sounds = useRef<{ [key: string]: HTMLAudioElement }>({});
    const shufflingInterval = useRef<NodeJS.Timeout | null>(null);
    const [animationKey, setAnimationKey] = useState(0);

    // Efeito para garantir que o código só rode no cliente.
    useEffect(() => {
        setIsMounted(true);

        // Pré-carregamento dos sons em um local seguro
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
                if (sound) {
                    sound.pause();
                    sound.currentTime = 0;
                }
            });
        };
    }, []);

    // Efeito para o Firebase, depende do isMounted.
    useEffect(() => {
        if (!isMounted) return;

        const playSound = (soundFile: string, loop = false) => {
            Object.values(sounds.current).forEach(sound => {
                if(sound) {
                    sound.pause();
                    sound.currentTime = 0;
                }
            });
            
            const soundToPlay = sounds.current[soundFile];
            if (soundToPlay) {
                soundToPlay.loop = loop;
                soundToPlay.play().catch(e => console.error("Erro ao tocar áudio:", e));
            }
        };

        const stopAllSounds = () => {
            Object.values(sounds.current).forEach(sound => {
                if (sound) {
                    sound.pause();
                    sound.currentTime = 0;
                }
            });
        };

        const stopShufflingAnimation = () => {
            if (shufflingInterval.current) {
                clearInterval(shufflingInterval.current);
                shufflingInterval.current = null;
            }
        };

        const disputeStateRef = ref(database, 'dispute/state');
        const unsubscribe = onValue(disputeStateRef, (snapshot) => {
            const action: DisputeAction | null = snapshot.val();
            if (!action) {
                stopAllSounds();
                stopShufflingAnimation();
                setDisplayState(initialDisplayState);
                return;
            }

            switch (action.type) {
                case 'RESET':
                    stopAllSounds();
                    stopShufflingAnimation();
                    setDisplayState(initialDisplayState);
                    break;
                
                case 'SHUFFLING_PARTICIPANTS':
                    stopShufflingAnimation();
                    playSound('tambor.mp3', true);
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'shuffling',
                        participantA: { id: 'shuffleA', name: '...', stars: 0, eliminated: false },
                        participantB: { id: 'shuffleB', name: '...', stars: 0, eliminated: false },
                    });
                    
                    const activeParticipants = action.activeParticipants || [];
                    if (activeParticipants.length > 1) {
                        shufflingInterval.current = setInterval(() => {
                            const shuffled = [...activeParticipants].sort(() => 0.5 - Math.random());
                             setDisplayState(prevState => ({
                                ...prevState,
                                participantA: shuffled[0],
                                participantB: shuffled[1],
                            }));
                        }, 150);
                    }
                    break;

                case 'UPDATE_PARTICIPANTS':
                    stopShufflingAnimation();
                    stopAllSounds();
                    playSound('sinos.mp3');
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'main',
                        participantA: action.participantA || null,
                        participantB: action.participantB || null,
                    });
                    break;

                case 'SHOW_WORD':
                    playSound('premio.mp3');
                    setDisplayState(prevState => ({
                        ...prevState,
                        word: action.word || null,
                        showWord: true,
                    }));
                    break;

                case 'HIDE_WORD':
                     setDisplayState(prevState => ({ ...prevState, showWord: false, word: null }));
                     break;

                case 'ROUND_WINNER':
                    stopAllSounds();
                    stopShufflingAnimation();
                    playSound('vencedor.mp3');
                    setAnimationKey(prev => prev + 1);
                    if (action.winner && action.loser && action.word) {
                       setDisplayState({
                           ...initialDisplayState,
                           view: 'round_winner',
                           roundWinner: { winner: action.winner, loser: action.loser, word: action.word }
                       });
                    }
                    break;

                case 'FINAL_WINNER':
                    stopAllSounds();
                    stopShufflingAnimation();
                    playSound('vencedor.mp3');
                    setAnimationKey(prev => prev + 1);
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'final_winner',
                        finalWinner: action.finalWinner
                    });
                    break;
                
                case 'TIE_ANNOUNCEMENT':
                    stopAllSounds();
                    stopShufflingAnimation();
                    setAnimationKey(prev => prev + 1);
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'tie_announcement',
                        tieWinners: action.tieWinners
                    });
                    break;

                case 'SHOW_WINNERS':
                    stopAllSounds();
                    stopShufflingAnimation();
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'winners_table',
                        winners: (action.winners || []).sort((a,b) => b.totalStars - a.totalStars)
                    });
                    break;
            }
        });

        return () => {
            unsubscribe();
            stopShufflingAnimation();
            stopAllSounds();
        };
    }, [isMounted]);

    if (!isMounted) {
      return null;
    }

    // ------ COMPONENTES DE RENDERIZAÇÃO ------

    const MainContent = () => (
        <div className="flex flex-col items-center justify-start pt-8 w-full h-full">
            <header className="flex items-center gap-4 text-accent">
                <h1 className="text-8xl font-melison font-bold tracking-tight">
                    Spelling Bee
                </h1>
                <Image src="/images/Bee.gif" alt="Bee Icon" width={100} height={100} unoptimized />
            </header>
            
            <div className="relative mt-8 text-center text-white w-full flex-1 flex flex-col justify-center items-center">
                <div className={cn("absolute top-0 left-0 right-0 flex flex-col items-center transition-opacity duration-300 z-10 w-full", displayState.showWord ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                    <h2 className="text-6xl font-bold text-accent font-melison">The Word Is</h2>
                    <div className="mt-4 h-32 flex items-center justify-center bg-accent text-accent-foreground rounded-2xl w-full max-w-2xl">
                        <p className="text-5xl font-bold uppercase tracking-[0.2em] break-all px-4 font-subjectivity">
                            {displayState.word || '...'}
                        </p>
                    </div>
                </div>
                
                <div className="relative w-full flex-1 flex items-center justify-center">
                    <div className="grid grid-cols-12 items-center w-full gap-4">
                        <div className="col-start-2 col-span-4 text-center">
                            <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.participantA?.name || 'Participante A'}</h3>
                        </div>
                        <div className="col-span-2 text-center">
                            <h3 className="text-8xl font-bold font-melison">Vs.</h3>
                        </div>
                        <div className="col-span-4 text-center">
                            <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.participantB?.name || 'Participante B'}</h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const RoundWinnerMessage = () => {
        if (!displayState.roundWinner) return null;
        const { winner, word } = displayState.roundWinner;

        return (
             <div key={animationKey} className="projetado-page fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 bg-accent-foreground/90 p-8 z-20">
                <div className="absolute top-8 flex items-center gap-4 text-accent">
                    <h1 className="text-6xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                    <Image src="/images/Bee.gif" alt="Bee Icon" width={60} height={60} unoptimized />
                </div>
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                     <div className="text-6xl mb-6 inline-block">
                        <b className="text-white bg-accent-foreground px-8 py-4 rounded-lg inline-block shadow-lg max-w-full break-words">{winner.name}</b>
                    </div>
                     <p className="text-5xl leading-tight font-semibold">
                        Ganhou a disputa soletrando
                         <br/> 
                        corretamente a palavra <b className="text-white bg-accent-foreground px-4 py-2 rounded-lg shadow-md mx-2 uppercase inline-block max-w-full break-words">{word}</b>
                        <br/> 
                        e recebeu uma estrela <Star className="inline-block w-16 h-16 text-accent fill-accent" /> !
                    </p>
                </div>
            </div>
        );
    }
    
    const FinalWinnerMessage = () => {
         if (!displayState.finalWinner) return null;
         const { finalWinner } = displayState;

        return (
             <div key={animationKey} className="animate-in fade-in zoom-in-95 duration-1000 fixed inset-0 z-30">
                <div className="flex items-center justify-center bg-black/60 w-full h-full">
                    <div className="bg-gradient-to-br from-yellow-300 to-amber-500 text-purple-900 border-8 border-white rounded-3xl p-20 shadow-2xl text-center max-w-5xl mx-auto relative overflow-hidden font-subjectivity">
                        <Crown className="absolute -top-16 -left-16 w-64 h-64 text-white/20 -rotate-12" />
                        <Crown className="absolute -bottom-20 -right-16 w-72 h-72 text-white/20 rotate-12" />
                        <h2 className="text-6xl font-black uppercase tracking-wider font-melison">Temos um Vencedor!</h2>
                        <Crown className="w-48 h-48 mx-auto my-8 text-white drop-shadow-lg" />
                        <p className="text-8xl font-black tracking-wide text-white bg-purple-800/80 px-8 py-4 rounded-xl shadow-inner font-melison">{finalWinner.name}</p>
                        <p className="mt-8 text-5xl font-bold flex items-center justify-center gap-4">
                            Com {finalWinner.stars} <Star className="w-12 h-12 text-white" />
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const TieAnnouncement = () => {
        if (!displayState.tieWinners) return null;
        const { tieWinners } = displayState;

        return (
             <div key={animationKey} className="projetado-page fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 bg-blue-950/90 p-8 z-20">
                <div className="absolute top-8 flex items-center gap-4 text-accent">
                    <h1 className="text-6xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                    <Image src="/images/Bee.gif" alt="Bee Icon" width={60} height={60} unoptimized />
                </div>
                 <div className="bg-stone-50 text-blue-900 border-8 border-blue-400 rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                    <ShieldAlert className="w-32 h-32 mx-auto text-blue-500 mb-6" />
                    <h2 className="text-7xl font-bold font-melison mb-4">Temos um Empate!</h2>
                    <p className="text-3xl mb-6">Os seguintes participantes irão para a rodada de desempate:</p>
                    <div className="text-4xl font-bold space-y-2">
                        {tieWinners.map(winner => (
                            <p key={winner.id}>{winner.name}</p>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const WinnersTable = () => {
        if (!displayState.winners) return null;

        return (
            <div className="projetado-page fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 p-8 z-20">
                <h1 className="text-8xl font-melison font-bold tracking-tight text-accent mb-8 flex items-center gap-4">
                    <Trophy className="w-20 h-20" /> Classificação dos Ganhadores
                </h1>
                <div className="w-full max-w-6xl bg-stone-50/90 rounded-2xl shadow-2xl p-4">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-0">
                                <TableHead className="w-1/2 text-center text-accent-foreground font-bold text-5xl font-melison py-4">Nome</TableHead>
                                <TableHead className="w-1/2 text-center text-accent-foreground font-bold text-5xl font-melison py-4">Estrelas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayState.winners.map((winner) => (
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

    return (
        <div className="projetado-page h-screen w-screen overflow-hidden relative">
            <MainContent />
            {displayState.view === 'round_winner' && <RoundWinnerMessage />}
            {displayState.view === 'final_winner' && <FinalWinnerMessage />}
            {displayState.view === 'tie_announcement' && <TieAnnouncement />}
            {displayState.view === 'winners_table' && <WinnersTable />}
        </div>
    );
}
