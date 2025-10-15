
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Maximize } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { Participant } from '@/app/page';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { AggregatedWinner } from '@/app/ganhadores/page';
import { motion, AnimatePresence } from 'framer-motion';


type DisputeAction = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'WORD_WINNER' | 'DUEL_WINNER' | 'FINAL_WINNER' | 'RESET' | 'SHUFFLING_PARTICIPANTS' | 'TIE_ANNOUNCEMENT' | 'NO_WINNER' | 'NO_WORD_WINNER' | 'SHOW_WINNERS' | 'SHOW_MESSAGE';
    payload?: any;
};

type TemplateStyle = {
    backgroundColor: string;
    textColor: string;
    highlightColor: string;
    highlightTextColor: string;
    borderColor: string;
    borderWidth: string;
    borderRadius: string;
    fontFamily: string;
    fontSize: string;
};

type MessageTemplate = {
    text: string;
    styles: TemplateStyle;
    enabled: boolean;
};

type MessageTemplates = {
    [key: string]: MessageTemplate;
};

type ViewState = 'idle' | 'shuffling' | 'duel' | 'message' | 'winners';

// --- Sub-components for different views ---

const DuelContent = ({
  participantA,
  participantB,
  showWord,
  words,
  duelScore,
  wordsPerRound
}: {
  participantA: Participant | null,
  participantB: Participant | null,
  showWord: boolean,
  words: string[],
  duelScore: { a: number, b: number },
  wordsPerRound: number
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative text-center text-white w-full flex-1 flex flex-col justify-center items-center overflow-hidden"
    >
        <div className={cn("absolute top-0 left-0 right-0 flex flex-col items-center transition-opacity duration-300 z-10", showWord ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
            <h2 className="text-6xl font-bold text-accent font-melison">The Word Is</h2>
            <div className="mt-4 flex flex-col items-center justify-center bg-accent text-accent-foreground rounded-2xl p-4">
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
    </motion.div>
);

const MessageView = ({ action, templates }: { action: DisputeAction, templates: MessageTemplates }) => {
    const templateKey = action.type.toLowerCase();
    const template = templates[templateKey];
    const payload = action.payload || {};

    if (!template || !template.enabled) return null;

    const data = {
        name: payload.winner?.name || payload.finalWinner?.name || '',
        words: Array.isArray(payload.duelWordsWon) ? payload.duelWordsWon.join(', ') : '',
        'words.0': Array.isArray(payload.words) && payload.words.length > 0 ? payload.words[0] : '',
        stars: payload.winner?.stars || payload.finalWinner?.stars || 0,
        participantsList: Array.isArray(payload.participants) ? `<div class="participants">${payload.participants.map((p: any) => `<div>${p.name}</div>`).join('')}</div>` : '',
        ...payload
    };

    let renderedText = template.text || '';
    renderedText = renderedText.replace(/\{\{\{\s*participantsList\s*\}\}\}/g, data.participantsList);
    renderedText = renderedText.replace(/\{\{\s*name\s*\}\}/g, data.name);
    renderedText = renderedText.replace(/\{\{\s*words\.0\s*\}\}/g, data['words.0']);
    renderedText = renderedText.replace(/\{\{\s*words\s*\}\}/g, data.words);
    renderedText = renderedText.replace(/\{\{\s*stars\s*\}\}/g, String(data.stars));

    const style: React.CSSProperties = {
        background: template.styles.backgroundColor,
        color: template.styles.textColor,
        border: `${template.styles.borderWidth} solid ${template.styles.borderColor}`,
        borderRadius: template.styles.borderRadius,
        fontFamily: template.styles.fontFamily,
        fontSize: template.styles.fontSize,
        padding: '4rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        textAlign: 'center',
        maxWidth: '60rem',
        transition: 'all 0.5s ease'
    } as React.CSSProperties;

    const highlightStyle = `background-color: ${template.styles.highlightColor}; color: ${template.styles.highlightTextColor}; padding: 0.2em 0.5em; border-radius: 0.3em; display: inline-block;`;
    renderedText = renderedText.replace(/<b>/g, `<b style="${highlightStyle}">`);

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed inset-0 z-20 flex flex-col items-center justify-center p-8 gap-4"
        >
            <div style={style} className={template.styles.fontFamily === 'Melison' ? 'font-melison' : 'font-subjectivity'}>
                <div className="dynamic-message-content" dangerouslySetInnerHTML={{ __html: renderedText }} />
            </div>
        </motion.div>
    );
}

const WinnersTable = ({ winners }: { winners: AggregatedWinner[] }) => {
    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        top: '300px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '64rem',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={containerStyle} 
            className="text-center text-white"
        >
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
        </motion.div>
    );
};


export default function ProjectionPage() {
    const [isReady, setIsReady] = useState(false);
    const [view, setView] = useState<ViewState>('idle');
    const [templates, setTemplates] = useState<MessageTemplates | null>(null);
    const [currentAction, setCurrentAction] = useState<DisputeAction | null>(null);
    const [appSettings, setAppSettings] = useState({ messageDisplayTime: 4000, shufflingSpeed: 150 });

    // State for Duel View
    const [duelState, setDuelState] = useState({
        participantA: null as Participant | null,
        participantB: null as Participant | null,
        showWord: false,
        words: [] as string[],
        duelScore: { a: 0, b: 0 },
        wordsPerRound: 1,
    });
    
    // State for Shuffling Animation
    const [shufflingParticipants, setShufflingParticipants] = useState<{a: Participant | null, b: Participant | null}>({ a: null, b: null });

    const shufflingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const sounds = useRef<{ [key: string]: HTMLAudioElement }>({});
    const isProcessingActionRef = useRef(false);
    const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    useEffect(() => {
        const soundFiles = ['tambor.mp3', 'sinos.mp3', 'premio.mp3', 'vencedor.mp3', 'erro.mp3'];
        soundFiles.forEach(file => {
            if (!sounds.current[file]) {
                sounds.current[file] = new Audio(`/som/${file}`);
                sounds.current[file].load();
            }
        });
        return () => {
            Object.values(sounds.current).forEach(sound => {
                if (sound && !sound.paused) { sound.pause(); sound.currentTime = 0; }
            });
            if (shufflingIntervalRef.current) clearInterval(shufflingIntervalRef.current);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isReady) return;
        
        const settingsRef = ref(database, 'settings');
        const unsubSettings = onValue(settingsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setAppSettings({
                    messageDisplayTime: (data.messageDisplayTime || 4) * 1000,
                    shufflingSpeed: data.shufflingSpeed || 150
                });
            }
        });

        const templatesRef = ref(database, 'message_templates');
        const unsubDesigns = onValue(templatesRef, (snapshot) => setTemplates(snapshot.val()));

        const disputeStateRef = ref(database, 'dispute/state');
        const unsubDispute = onValue(disputeStateRef, (snapshot) => {
            const newAction: DisputeAction | null = snapshot.val();
            if (newAction && (!isProcessingActionRef.current || newAction.type === 'RESET')) {
                processAction(newAction);
            } else if (!newAction && view !== 'idle') {
                resetToIdle();
            }
        });

        return () => {
            unsubSettings();
            unsubDesigns();
            unsubDispute();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady]);

    const playSound = (soundFile: string, loop = false) => {
        Object.values(sounds.current).forEach(sound => {
            if (sound && !sound.paused) { sound.pause(); sound.currentTime = 0; }
        });
        const soundToPlay = sounds.current[soundFile];
        if (soundToPlay) {
            soundToPlay.loop = loop;
            soundToPlay.currentTime = 0;
            soundToPlay.play().catch(e => {
              if (e.name !== 'AbortError') console.error("Erro ao tocar áudio:", e);
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
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        isProcessingActionRef.current = true;
        setCurrentAction(action);
        
        switch (action.type) {
            case 'SHUFFLING_PARTICIPANTS':
                setView('shuffling');
                startShufflingAnimation(action.payload.activeParticipants || []);
                playSound('tambor.mp3', true);
                isProcessingActionRef.current = false;
                break;

            case 'UPDATE_PARTICIPANTS':
                stopShufflingAnimation();
                setView('duel');
                setDuelState(prev => ({
                    ...prev,
                    participantA: action.payload.participantA || null,
                    participantB: action.payload.participantB || null,
                    duelScore: action.payload.duelScore || { a: 0, b: 0 },
                    wordsPerRound: action.payload.wordsPerRound || 1,
                    showWord: false,
                }));
                if (action.payload.participantA) {
                    playSound('sinos.mp3');
                }
                isProcessingActionRef.current = false;
                break;

            case 'SHOW_WORD':
                setView('duel');
                setDuelState(prev => ({ ...prev, words: action.payload.words || [], showWord: true }));
                playSound('premio.mp3');
                isProcessingActionRef.current = false;
                break;

            case 'HIDE_WORD':
                setDuelState(prev => ({ ...prev, showWord: false }));
                isProcessingActionRef.current = false;
                break;

            case 'WORD_WINNER':
            case 'DUEL_WINNER':
            case 'FINAL_WINNER':
            case 'TIE_ANNOUNCEMENT':
            case 'NO_WORD_WINNER':
            case 'NO_WINNER':
            case 'SHOW_MESSAGE':
                 setView('message');
                 playSound(action.type === 'NO_WORD_WINNER' || action.type === 'NO_WINNER' ? 'erro.mp3' : 'vencedor.mp3');
                 messageTimeoutRef.current = setTimeout(() => {
                    if (action.type === 'WORD_WINNER') {
                        // After showing WORD_WINNER message, go back to duel view with updated score
                        setView('duel');
                         setDuelState(prev => ({
                            ...prev,
                            showWord: false,
                            duelScore: action.payload.duelScore
                        }));
                        setCurrentAction(null);
                        isProcessingActionRef.current = false;
                    } else if (action.type !== 'DUEL_WINNER' && action.type !== 'FINAL_WINNER') {
                        resetToIdle();
                    }
                    // For DUEL_WINNER and FINAL_WINNER, we wait for the next action from the controller
                 }, appSettings.messageDisplayTime);
                break;

            case 'SHOW_WINNERS':
                setView('winners');
                isProcessingActionRef.current = false; // Persistent state
                break;
            
            case 'RESET':
                resetToIdle();
                break;
        }
    };

    const resetToIdle = () => {
        stopShufflingAnimation();
        Object.values(sounds.current).forEach(s => { if(s) {s.pause(); s.currentTime = 0;} });
        setView('idle');
        setCurrentAction(null);
        setDuelState({ participantA: null, participantB: null, showWord: false, words: [], duelScore: { a: 0, b: 0 }, wordsPerRound: 1 });
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        isProcessingActionRef.current = false;
    };

    const startShufflingAnimation = (participants: Participant[]) => {
        stopShufflingAnimation();
        if (participants.length > 1) {
            shufflingIntervalRef.current = setInterval(() => {
                const shuffled = [...participants].sort(() => 0.5 - Math.random());
                setShufflingParticipants({ a: shuffled[0] || null, b: shuffled[1] || null });
            }, appSettings.shufflingSpeed);
        }
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
                <AnimatePresence mode="wait">
                    {view === 'duel' && (
                        <DuelContent {...duelState} />
                    )}
                    {view === 'shuffling' && (
                         <DuelContent participantA={shufflingParticipants.a} participantB={shufflingParticipants.b} showWord={false} words={[]} duelScore={{a:0, b:0}} wordsPerRound={1} />
                    )}
                    {view === 'winners' && currentAction?.payload?.winners && (
                        <WinnersTable winners={currentAction.payload.winners} />
                    )}
                </AnimatePresence>
            </main>
            <AnimatePresence>
                {view === 'message' && currentAction && templates && (
                    <MessageView action={currentAction} templates={templates} />
                )}
            </AnimatePresence>
        </div>
    );
}

    