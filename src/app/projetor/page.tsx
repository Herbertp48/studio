
'use client';

import { useState, useEffect, useRef } from 'react';
import { Maximize } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { Participant } from '@/app/(app)/page';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { AggregatedWinner } from '@/app/ganhadores/page';
import type { AllDesigns } from '@/app/estudio/page';
import { motion, AnimatePresence } from 'framer-motion';


type DisputeAction = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'WORD_WINNER' | 'DUEL_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'TIE_ANNOUNCEMENT' | 'NO_WINNER' | 'NO_WORD_WINNER' | 'SHOW_WINNERS' | 'SHOW_MESSAGE';
    payload?: any;
};

const messageActionTypes: DisputeAction['type'][] = ['WORD_WINNER', 'DUEL_WINNER', 'FINAL_WINNER', 'TIE_ANNOUNCEMENT', 'NO_WORD_WINNER', 'NO_WINNER', 'SHOW_MESSAGE'];


export default function ProjectionPage() {
    const [isReady, setIsReady] = useState(false);
    const [designs, setDesigns] = useState<AllDesigns | null>(null);
    const [currentAction, setCurrentAction] = useState<DisputeAction | null>(null);
    const [showContent, setShowContent] = useState(true);
    const [wordsPerRound, setWordsPerRound] = useState(1);

    const [participantA, setParticipantA] = useState<Participant | null>(null);
    const [participantB, setParticipantB] = useState<Participant | null>(null);
    const [showWord, setShowWord] = useState(false);
    const [words, setWords] = useState<string[]>([]);
    const [duelScore, setDuelScore] = useState({ a: 0, b: 0 });
    
    const shufflingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const sounds = useRef<{ [key: string]: HTMLAudioElement }>({});
    const isProcessingActionRef = useRef(false);
    const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    useEffect(() => {
        const soundFiles = ['tambor.mp3', 'sinos.mp3', 'premio.mp3', 'vencedor.mp3', 'erro.mp3'];
        soundFiles.forEach(file => {
            if (!sounds.current[file]) {
                const audio = new Audio(`/som/${file}`);
                audio.load();
                sounds.current[file] = audio;
            }
        });
        return () => {
            stopAllSounds();
            stopShufflingAnimation();
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isReady) return;

        const designsRef = ref(database, 'designs');
        const unsubDesigns = onValue(designsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setDesigns(data);
            }
        });

        const disputeStateRef = ref(database, 'dispute/state');
        const unsubDispute = onValue(disputeStateRef, (snapshot) => {
            const newAction: DisputeAction | null = snapshot.val();
             if (newAction) {
                if (isProcessingActionRef.current && newAction.type !== 'RESET') {
                    return;
                }
                processAction(newAction);
            } else {
                if (!isProcessingActionRef.current) {
                    resetToIdle();
                }
            }
        });

        return () => {
            unsubDesigns();
            unsubDispute();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady]);

    const stopAllSounds = () => {
        Object.values(sounds.current).forEach(sound => {
            if (sound && !sound.paused) { sound.pause(); sound.currentTime = 0; }
        });
    };
    
    const playSound = (soundFile: string, loop = false) => {
        stopAllSounds();
        const soundToPlay = sounds.current[soundFile];
        if (soundToPlay) {
            soundToPlay.loop = loop;
            soundToPlay.currentTime = 0;
            soundToPlay.play().catch(e => {
              if (e.name !== 'AbortError') { console.error("Erro ao tocar áudio:", e); }
            });
        }
    };

    const stopShufflingAnimation = () => {
        if (shufflingIntervalRef.current) {
            clearInterval(shufflingIntervalRef.current);
            shufflingIntervalRef.current = null;
        }
    };
    
    const handleEnterFullscreen = () => {
        if (isReady) return;
        Object.values(sounds.current).forEach(sound => {
            sound.load(); sound.play().then(() => sound.pause()).catch(() => {});
        });
        setIsReady(true);
        document.documentElement.requestFullscreen?.().catch(() => {});
    };

    const processAction = (action: DisputeAction) => {
        stopAllSounds();
        if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = null;
        }
        
        const actionType = action.type;
        const payload = action.payload || {};
        
        isProcessingActionRef.current = true;
        setCurrentAction(action);
        
        switch (actionType) {
            case 'SHUFFLING_PARTICIPANTS':
                setShowContent(true);
                setShowWord(false);
                setWords([]);
                setDuelScore({ a: 0, b: 0 });
                startShufflingAnimation(payload.activeParticipants || []);
                playSound('tambor.mp3', true);
                break;
            case 'UPDATE_PARTICIPANTS':
                stopShufflingAnimation();
                setShowContent(true);
                setShowWord(false);
                setParticipantA(payload.participantA || null);
                setParticipantB(payload.participantB || null);
                setDuelScore(payload.duelScore || { a: 0, b: 0 });
                setWordsPerRound(payload.wordsPerRound || 1);
                playSound('sinos.mp3');
                isProcessingActionRef.current = false;
                break;
            case 'SHOW_WORD':
                setShowContent(true);
                setWords(payload.words || []);
                setShowWord(true);
                playSound('premio.mp3');
                isProcessingActionRef.current = false;
                break;
            case 'HIDE_WORD':
                setShowWord(false);
                isProcessingActionRef.current = false;
                break;
            case 'WORD_WINNER':
            case 'DUEL_WINNER':
            case 'FINAL_WINNER':
            case 'TIE_ANNOUNCEMENT':
            case 'NO_WORD_WINNER':
                 setShowContent(false);
                 setShowWord(false);
                 playSound(actionType === 'NO_WORD_WINNER' ? 'erro.mp3' : 'vencedor.mp3');
                 messageTimeoutRef.current = setTimeout(() => {
                    resetToIdle();
                 }, 4000);
                break;
            case 'RESET':
                resetToIdle();
                break;
            case 'NO_WINNER':
            case 'SHOW_MESSAGE':
                setShowContent(false);
                setShowWord(false);
                 messageTimeoutRef.current = setTimeout(() => {
                    resetToIdle();
                 }, 4000);
                break;
            case 'SHOW_WINNERS':
                setShowContent(false);
                setShowWord(false);
                isProcessingActionRef.current = false; // This is a persistent state
                break;
        }
    };


    const resetToIdle = () => {
        stopAllSounds();
        stopShufflingAnimation();
        setCurrentAction(null);
        setParticipantA(null);
        setParticipantB(null);
        setShowWord(false);
        setWords([]);
        setDuelScore({ a: 0, b: 0 });
        setShowContent(true);
        isProcessingActionRef.current = false;
    };

    const startShufflingAnimation = (participants: Participant[]) => {
        stopShufflingAnimation();
        
        shufflingIntervalRef.current = setInterval(() => {
            const shuffled = [...participants].sort(() => 0.5 - Math.random());
            setParticipantA(shuffled[0] || null);
            setParticipantB(shuffled[1] || null);
        }, 150);
    };

    const shouldShowMessage = currentAction && messageActionTypes.includes(currentAction.type);
    const shouldShowDuel = showContent && !shouldShowMessage && currentAction?.type !== 'SHOW_WINNERS';


    const renderMessage = () => {
        if (!shouldShowMessage || !currentAction || !designs) return null;
    
        const templateKey = currentAction.type.toLowerCase() as keyof AllDesigns;
        const template = designs[templateKey];
        const payload = currentAction.payload || {};
    
        if (!template) return null;

        const data = {
            name: payload.winner?.name || payload.finalWinner?.name || '',
            words: Array.isArray(payload.duelWordsWon) ? payload.duelWordsWon.join(', ') : '',
            'words.0': Array.isArray(payload.words) && payload.words.length > 0 ? payload.words[0] : '',
            stars: payload.winner?.stars || payload.finalWinner?.stars || 0,
            participantsList: Array.isArray(payload.participants) ? payload.participants.map(p => p.name).join(', ') : '',
            ...payload
        };

        const interpolate = (text: string) => {
            if (!text) return '';
            return text
                .replace(/\{\{\{\s*participantsList\s*\}\}\}/g, data.participantsList)
                .replace(/\{\{\s*name\s*\}\}/g, data.name)
                .replace(/\{\{\s*words\.0\s*\}\}/g, data['words.0'])
                .replace(/\{\{\s*words\s*\}\}/g, data.words)
                .replace(/\{\{\s*stars\s*\}\}/g, String(data.stars));
        }

        return (
            <AnimatePresence>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="fixed inset-0 z-20 flex flex-col items-center justify-center p-8 gap-4"
                    style={{ backgroundColor: template.backgroundColor }}
                >
                    {template.text1 && <h1 style={{ fontSize: template.text1FontSize, color: template.text1Color }} className="font-bold font-melison text-center">{interpolate(template.text1)}</h1>}
                    {template.text2 && <h2 style={{ fontSize: template.text2FontSize, color: template.text2Color }} className="font-bold font-subjectivity text-center">{interpolate(template.text2)}</h2>}
                    {template.text3 && <h3 style={{ fontSize: template.text3FontSize, color: template.text3Color }} className="font-bold font-subjectivity text-center">{interpolate(template.text3)}</h3>}
                </motion.div>
            </AnimatePresence>
        );
    };

    const renderDuelContent = () => (
        <div className={cn(
            "relative text-center text-white w-full flex-1 flex flex-col justify-center items-center overflow-hidden transition-opacity duration-500",
            !shouldShowDuel ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}>
            <div className={cn("absolute top-0 left-0 right-0 flex flex-col items-center transition-opacity duration-300 z-10 w-full", showWord ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                <h2 className="text-6xl font-bold text-accent font-melison">A Palavra é</h2>
                <div className="mt-4 flex flex-col items-center justify-center bg-accent text-accent-foreground rounded-2xl w-full max-w-4xl p-4">
                     {words.map(word => (
                        <p key={word} className="text-5xl font-bold uppercase tracking-[0.2em] break-all px-4 font-subjectivity">
                            {word}
                        </p>
                    ))}
                </div>
            </div>
            
            <div className="relative w-full flex-1 flex items-center justify-center">
                <div className="flex items-start justify-around w-full">
                    <div className="flex-1 text-center">
                        <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{participantA?.name || 'Participante A'}</h3>
                        {wordsPerRound > 1 && <p className="text-4xl font-bold mt-4">Pontos: {duelScore?.a || 0}</p>}
                    </div>
                    <div className="flex-shrink-0 text-center px-4">
                        <h3 className="text-8xl font-bold font-melison">Vs.</h3>
                    </div>
                    <div className="flex-1 text-center">
                        <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{participantB?.name || 'Participante B'}</h3>
                         {wordsPerRound > 1 && <p className="text-4xl font-bold mt-4">Pontos: {duelScore?.b || 0}</p>}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderWinnersTable = () => {
        if (currentAction?.type !== 'SHOW_WINNERS' || !currentAction.payload?.winners) return null;
    
        const winners: AggregatedWinner[] = currentAction.payload.winners;
        
        const containerStyle: React.CSSProperties = {
            position: 'absolute',
            top: '300px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '64rem', // max-w-6xl
        };

        return (
            <div style={containerStyle} className={cn(
                "text-center text-white transition-opacity duration-500",
                 !showContent ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}>
                 <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl w-full">
                    <h2 className="text-6xl font-bold text-accent font-melison mb-8">Classificação Final</h2>
                    <table className="w-full text-2xl">
                        <thead>
                            <tr className="border-b-4 border-accent">
                                <th className="p-4 text-left font-melison text-4xl">Nome</th>
                                <th className="p-4 text-left font-melison text-4xl">Palavras Acertadas</th>
                                <th className="p-4 text-center font-melison text-4xl">Estrelas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {winners.map((winner, index) => (
                                <tr key={index} className="border-b-2 border-accent/50">
                                    <td className="p-4 text-left font-subjectivity font-bold">{winner.name}</td>
                                    <td className="p-4 text-left font-subjectivity text-xl">
                                        {Object.entries(winner.words).map(([word, count]) => `${word} (x${count})`).join(', ')}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {Array.from({ length: winner.totalStars }).map((_, i) => (
                                                <span key={i} className="text-yellow-400 text-4xl">⭐</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        );
    };

    if (!isReady) {
        return (
            <div className="projetado-page h-screen w-screen overflow-hidden relative cursor-pointer" onClick={handleEnterFullscreen}>
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="text-center text-accent animate-pulse">
                        <Maximize className="w-24 h-24 mx-auto" />
                        <h1 className="text-6xl font-melison font-bold mt-4">Clique para Entrar em Tela Cheia</h1>
                        <p className="text-2xl mt-2 font-subjectivity">Isso irá otimizar a visualização e ativar o som.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="projetado-page h-screen w-screen overflow-hidden relative flex flex-col items-center justify-start">
            <header className="flex flex-shrink-0 items-center gap-4 text-accent py-4">
                <h1 className="text-8xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                <Image src="/images/Bee.gif" alt="Bee Icon" width={100} height={100} unoptimized />
            </header>
            <main className='w-full flex-1 flex flex-col justify-start items-center pt-16 px-8'>
                {renderDuelContent()}
                {renderWinnersTable()}
            </main>
            <AnimatePresence>
                {shouldShowMessage && renderMessage()}
            </AnimatePresence>
        </div>
    );
}

    