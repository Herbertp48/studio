
'use client';

import { useState, useEffect, useRef } from 'react';
import type { Participant } from '@/app/page';
import { Crown, Star, Trophy, ShieldAlert, Maximize, CircleX } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { AggregatedWinner } from '@/app/ganhadores/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DisputeAction = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'WORD_WINNER' | 'DUEL_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'SHOW_WINNERS' | 'TIE_ANNOUNCEMENT' | 'NO_WINNER' | 'NO_WORD_WINNER';
    participantA?: Participant | null;
    participantB?: Participant | null;
    words?: string[] | null;
    winner?: Participant | null;
    loser?: Participant | null;
    finalWinner?: Participant | null;
    activeParticipants?: Participant[];
    winners?: AggregatedWinner[];
    tieWinners?: Participant[];
    duelScore?: { a: number, b: number };
    duelWordsWon?: string[];
}

type DisplayState = {
    view: 'main' | 'word_winner' | 'duel_winner' | 'final_winner' | 'winners_table' | 'tie_announcement' | 'no_winner';
    participantA: Participant | null;
    participantB: Participant | null;
    words: string[] | null;
    showWord: boolean;
    wordWinner?: { winner: Participant | null, words: string[] };
    duelWinner?: { winner: Participant | null, words: string[] };
    finalWinner?: Participant;
    winners?: AggregatedWinner[];
    tieWinners?: Participant[];
    duelScore: { a: number, b: number };
};

const initialDisplayState: DisplayState = {
    view: 'main',
    participantA: null,
    participantB: null,
    words: null,
    showWord: false,
    duelScore: { a: 0, b: 0 }
};

export default function ProjectionPage() {
    const [isReady, setIsReady] = useState(false);
    const [displayState, setDisplayState] = useState<DisplayState>(initialDisplayState);
    const sounds = useRef<{ [key: string]: HTMLAudioElement }>({});
    const [animationKey, setAnimationKey] = useState(0);
    const shufflingIntervalRef = useRef<NodeJS.Timeout | null>(null);

     const handleEnterFullscreen = () => {
        if (isReady) return;

        // Ativa o áudio
        Object.values(sounds.current).forEach(sound => {
            sound.load();
            sound.play().then(() => sound.pause()).catch(() => {});
        });
        setIsReady(true);

        // Entra em tela cheia
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) { /* Safari */
            (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).msRequestFullscreen) { /* IE11 */
            (elem as any).msRequestFullscreen();
        }
    };

    // Efeito para carregar os sons
    useEffect(() => {
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
        };
    }, []);

    // Efeito para o Firebase, depende do isReady.
    useEffect(() => {
        if (!isReady) return;

        const stopAllSounds = () => {
            Object.values(sounds.current).forEach(sound => {
                if (sound && !sound.paused) {
                    sound.pause();
                    sound.currentTime = 0;
                }
            });
        };

        const playSound = (soundFile: string, loop = false) => {
            stopAllSounds();
            
            const soundToPlay = sounds.current[soundFile];
            if (soundToPlay) {
                soundToPlay.loop = loop;
                soundToPlay.play().catch(e => {
                  if (e.name !== 'AbortError') {
                    console.error("Erro ao tocar áudio:", e)
                  }
                });
            }
        };

         const stopShufflingAnimation = () => {
            if (shufflingIntervalRef.current) {
                clearInterval(shufflingIntervalRef.current);
                shufflingIntervalRef.current = null;
            }
        };

        const startShufflingAnimation = (participants: Participant[]) => {
            stopShufflingAnimation();
            playSound('tambor.mp3', true);
            shufflingIntervalRef.current = setInterval(() => {
                const shuffled = [...participants].sort(() => 0.5 - Math.random());
                 setDisplayState(prevState => ({
                    ...prevState,
                    participantA: shuffled[0] || null,
                    participantB: shuffled[1] || null,
                 }));
            }, 150);
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
                    if (!shufflingIntervalRef.current) {
                        startShufflingAnimation(action.activeParticipants || []);
                    }
                    setDisplayState(prevState => ({
                        ...prevState,
                        view: 'main',
                        showWord: false,
                        words: null,
                        duelScore: { a: 0, b: 0 }
                    }));
                    break;

                case 'UPDATE_PARTICIPANTS':
                    stopShufflingAnimation();
                    if (!shufflingIntervalRef.current && !displayState.participantA) { 
                        playSound('sinos.mp3');
                    }
                    setDisplayState(prevState => ({
                        ...prevState,
                        view: 'main',
                        showWord: false,
                        participantA: action.participantA || prevState.participantA,
                        participantB: action.participantB || prevState.participantB,
                        duelScore: action.duelScore || prevState.duelScore,
                    }));
                    break;

                case 'SHOW_WORD':
                    playSound('premio.mp3');
                    setDisplayState(prevState => ({
                        ...prevState,
                        view: 'main',
                        words: action.words || null,
                        showWord: true,
                    }));
                    break;

                case 'HIDE_WORD':
                     setDisplayState(prevState => ({ ...prevState, showWord: false, words: null, view: 'main' }));
                     break;

                case 'WORD_WINNER':
                    stopAllSounds();
                    if(action.winner) playSound('vencedor.mp3');
                    setAnimationKey(prev => prev + 1);
                    setDisplayState(prevState => ({
                        ...prevState,
                        view: 'word_winner',
                        wordWinner: { winner: action.winner || null, words: action.words || [] }
                    }));
                    break;
                
                case 'NO_WORD_WINNER':
                    stopAllSounds();
                    setAnimationKey(prev => prev + 1);
                     setDisplayState(prevState => ({
                        ...prevState,
                        view: 'word_winner',
                        wordWinner: { winner: null, words: action.words || [] }
                    }));
                    break;

                case 'DUEL_WINNER':
                    stopAllSounds();
                    playSound('vencedor.mp3');
                    setAnimationKey(prev => prev + 1);
                    setDisplayState(prevState => ({
                        ...prevState,
                        view: 'duel_winner',
                        duelWinner: { winner: action.winner || null, words: action.duelWordsWon || [] }
                    }));
                    break;

                case 'FINAL_WINNER':
                    stopShufflingAnimation();
                    stopAllSounds();
                    playSound('vencedor.mp3');
                    setAnimationKey(prev => prev + 1);
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'final_winner',
                        finalWinner: action.finalWinner
                    });
                    break;
                
                case 'NO_WINNER':
                    stopShufflingAnimation();
                    stopAllSounds();
                    setAnimationKey(prev => prev + 1);
                    setDisplayState({ ...initialDisplayState, view: 'no_winner' });
                    break;

                case 'TIE_ANNOUNCEMENT':
                    stopShufflingAnimation();
                    playSound('sinos.mp3');
                    setAnimationKey(prev => prev + 1);
                    setDisplayState({
                        ...initialDisplayState,
                        view: 'tie_announcement',
                        tieWinners: action.tieWinners
                    });
                    break;

                case 'SHOW_WINNERS':
                    stopShufflingAnimation();
                    stopAllSounds();
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
            stopAllSounds();
            stopShufflingAnimation();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady]);

    // ------ COMPONENTES DE RENDERIZAÇÃO ------

    const MainContent = () => (
        <div className="flex flex-col items-center justify-center w-full h-full">
            <header className="flex items-center gap-4 text-accent py-4">
                <h1 className="text-8xl font-melison font-bold tracking-tight">
                    Spelling Bee
                </h1>
                <Image src="/images/Bee.gif" alt="Bee Icon" width={100} height={100} unoptimized />
            </header>
            
            <div className="relative text-center text-white w-full flex-1 flex flex-col justify-center items-center overflow-hidden">
                <div className={cn("absolute top-0 left-0 right-0 flex flex-col items-center transition-opacity duration-300 z-10 w-full", displayState.showWord ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                    <h2 className="text-6xl font-bold text-accent font-melison">The Word Is</h2>
                    <div className="mt-4 flex flex-col items-center justify-center bg-accent text-accent-foreground rounded-2xl w-full max-w-2xl p-4">
                        {displayState.words && displayState.words.map(word => (
                            <p key={word} className="text-5xl font-bold uppercase tracking-[0.2em] break-all px-4 font-subjectivity">
                                {word}
                            </p>
                        ))}
                    </div>
                </div>
                
                <div className="relative w-full flex-1 flex items-center justify-center">
                    <div className="flex items-start justify-around w-full">
                        <div className="flex-1 text-center">
                            <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.participantA?.name || 'Participante A'}</h3>
                            <p className="text-4xl font-bold mt-4">Pontos: {displayState.duelScore?.a || 0}</p>
                        </div>
                        <div className="flex-shrink-0 text-center px-4">
                            <h3 className="text-8xl font-bold font-melison">Vs.</h3>
                        </div>
                        <div className="flex-1 text-center">
                            <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{displayState.participantB?.name || 'Participante B'}</h3>
                             <p className="text-4xl font-bold mt-4">Pontos: {displayState.duelScore?.b || 0}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const WordWinnerMessage = () => {
        if (!displayState.wordWinner) return null;
        const { winner, words } = displayState.wordWinner;
        const word = words && words.length > 0 ? words[0] : null;

        if (winner && word) {
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
                            Ganhou a disputa soletrando corretamente a palavra <b className="text-white bg-accent px-4 py-1 rounded-md">{word}</b> e marcou um ponto!
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div key={animationKey} className="projetado-page fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 bg-accent-foreground/90 p-8 z-20">
                <div className="absolute top-8 flex items-center gap-4 text-accent">
                    <h1 className="text-6xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                    <Image src="/images/Bee.gif" alt="Bee Icon" width={60} height={60} unoptimized />
                </div>
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                    <CircleX className="w-32 h-32 mx-auto text-destructive mb-6" />
                    <h2 className="text-7xl font-bold font-melison mb-4">Rodada sem Vencedor</h2>
                    <p className="text-3xl">Ninguém pontuou com a palavra <b className="text-white bg-destructive px-4 py-1 rounded-md">{word}</b>.</p>
                </div>
            </div>
        );
    }
    
     const DuelWinnerMessage = () => {
        if (!displayState.duelWinner || !displayState.duelWinner.winner) return null;
        const { winner, words } = displayState.duelWinner;

        return (
            <div key={animationKey} className="projetado-page fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 bg-accent-foreground/90 p-8 z-20">
                <div className="absolute top-8 flex items-center gap-4 text-accent">
                    <h1 className="text-6xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                    <Image src="/images/Bee.gif" alt="Bee Icon" width={60} height={60} unoptimized />
                </div>
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                    <div className="text-6xl mb-6 inline-block">
                        <b className="text-white bg-accent-foreground px-8 py-4 rounded-lg inline-block shadow-lg max-w-full break-words">{winner!.name}</b>
                    </div>
                    <p className="text-5xl leading-tight font-semibold">
                        Ganhou a disputa soletrando corretamente a(s) palavra(s): <b className="text-white bg-accent px-4 py-1 rounded-md">{words.join(', ')}</b> e recebeu uma estrela <span className="text-yellow-400">⭐</span>!
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

    const NoWinnerMessage = () => {
        return (
            <div key={animationKey} className="projetado-page fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 bg-accent-foreground/90 p-8 z-20">
                <div className="absolute top-8 flex items-center gap-4 text-accent">
                    <h1 className="text-6xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                    <Image src="/images/Bee.gif" alt="Bee Icon" width={60} height={60} unoptimized />
                </div>
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                    <Trophy className="w-32 h-32 mx-auto text-accent-foreground/50 mb-6" />
                    <h2 className="text-7xl font-bold font-melison mb-4">Fim da Disputa</h2>
                    <p className="text-3xl">Não houve vencedores nesta competição.</p>
                </div>
            </div>
        );
    }

    const TieAnnouncement = () => {
        if (!displayState.tieWinners) return null;
        const { tieWinners } = displayState;
    
        return (
            <div key={animationKey} className="projetado-page fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 bg-accent-foreground/90 p-8 z-20">
                <div className="absolute top-8 flex items-center gap-4 text-accent">
                    <h1 className="text-6xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                    <Image src="/images/Bee.gif" alt="Bee Icon" width={60} height={60} unoptimized />
                </div>
                <div className="bg-stone-50 text-accent-foreground border-8 border-accent rounded-2xl p-12 shadow-2xl text-center max-w-4xl mx-auto font-subjectivity">
                    <ShieldAlert className="w-32 h-32 mx-auto text-accent mb-6" />
                    <h2 className="text-7xl font-bold font-melison mb-4">Temos um Empate!</h2>
                    <p className="text-3xl mb-6">Os seguintes participantes irão para a rodada de desempate:</p>
                    <div className="text-4xl font-bold space-y-2">
                        {tieWinners.map(winner => (
                            <p key={winner.id} className="text-white bg-accent-foreground px-6 py-2 rounded-lg shadow-md max-w-full break-words">{winner.name}</p>
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

    const renderContent = () => {
        switch (displayState.view) {
            case 'word_winner':
                return <WordWinnerMessage />;
            case 'duel_winner':
                return <DuelWinnerMessage />;
            case 'final_winner':
                return <FinalWinnerMessage />;
            case 'no_winner':
                return <NoWinnerMessage />;
            case 'tie_announcement':
                return <TieAnnouncement />;
            case 'winners_table':
                return <WinnersTable />;
            case 'main':
            default:
                return <MainContent />;
        }
    }

    return (
        <div 
            className="projetado-page h-screen w-screen overflow-hidden relative cursor-pointer"
            onClick={handleEnterFullscreen}
        >
            {!isReady ? (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="text-center text-accent animate-pulse">
                        <Maximize className="w-24 h-24 mx-auto" />
                        <h1 className="text-6xl font-melison font-bold mt-4">Clique para Entrar em Tela Cheia</h1>
                        <p className="text-2xl mt-2 font-subjectivity">Isso irá otimizar a visualização e ativar o som.</p>
                    </div>
                </div>
            ) : renderContent()}
        </div>
    );
}

    
