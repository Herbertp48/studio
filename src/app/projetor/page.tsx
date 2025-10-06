'use client';

import { useState, useEffect, useRef } from 'react';
import { Maximize } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import type { Participant } from '@/app/page';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { AggregatedWinner } from '@/app/ganhadores/page';

// --- Tipos de Dados ---
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

const initialTemplates: MessageTemplates = {
    word_winner: {
        text: '<b>{{name}}</b> ganhou a disputa soletrando corretamente a palavra <b>{{words.0}}</b> e marcou um ponto!',
        styles: { backgroundColor: '#fffbe6', textColor: '#6d21db', highlightColor: 'rgba(0,0,0,0.1)', highlightTextColor: '#6d21db', borderColor: '#fdc244', borderWidth: '8px', borderRadius: '20px', fontFamily: 'Subjectivity', fontSize: '2.5rem' },
        enabled: true,
    },
    duel_winner: {
        text: '<b>{{name}}</b> ganhou o duelo soletrando: <br><i><b>{{words}}</b></i><br> e ganhou uma estrela ⭐!',
        styles: { backgroundColor: '#fffbe6', textColor: '#6d21db', highlightColor: 'rgba(0,0,0,0.1)', highlightTextColor: '#6d21db', borderColor: '#fdc244', borderWidth: '8px', borderRadius: '20px', fontFamily: 'Subjectivity', fontSize: '2.5rem' },
        enabled: true,
    },
    no_word_winner: {
        text: '<h2>Rodada sem Vencedor</h2>Ninguém pontuou com a palavra <b>{{words.0}}</b>.',
        styles: { backgroundColor: '#fffbe6', textColor: '#b91c1c', highlightColor: 'rgba(0,0,0,0.1)', highlightTextColor: '#b91c1c', borderColor: '#ef4444', borderWidth: '8px', borderRadius: '20px', fontFamily: 'Subjectivity', fontSize: '2.5rem' },
        enabled: true,
    },
     final_winner: {
        text: '<h2>Temos um Vencedor!</h2><p class="icon">👑</p><h1><b>{{name}}</b></h1><p>Com {{stars}} ⭐</p>',
        styles: { backgroundColor: 'linear-gradient(to bottom right, #fde047, #f59e0b)', textColor: '#4c1d95', highlightColor: 'rgba(255,255,255,0.2)', highlightTextColor: '#4c1d95', borderColor: '#ffffff', borderWidth: '8px', borderRadius: '24px', fontFamily: 'Melison', fontSize: '3rem' },
        enabled: true,
    },
     tie_announcement: {
        text: '<h2>Temos um Empate!</h2><p class="icon">🛡️</p><p>Os seguintes participantes irão para a rodada de desempate:</p>{{{participantsList}}}',
        styles: { backgroundColor: '#fffbe6', textColor: '#6d21db', highlightColor: 'rgba(0,0,0,0.1)', highlightTextColor: '#6d21db', borderColor: '#fdc244', borderWidth: '8px', borderRadius: '20px', fontFamily: 'Subjectivity', fontSize: '2.5rem' },
        enabled: true,
    },
};

// --- Componente Principal ---
export default function ProjectionPage() {
    const [isReady, setIsReady] = useState(false);
    const [templates, setTemplates] = useState<MessageTemplates>(initialTemplates);
    const [currentAction, setCurrentAction] = useState<DisputeAction | null>(null);
    const [showDuelContent, setShowDuelContent] = useState(true);

    const [participantA, setParticipantA] = useState<Participant | null>(null);
    const [participantB, setParticipantB] = useState<Participant | null>(null);
    const [showWord, setShowWord] = useState(false);
    const [words, setWords] = useState<string[]>([]);
    const [duelScore, setDuelScore] = useState({ a: 0, b: 0 });
    
    const shufflingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const sounds = useRef<{ [key: string]: HTMLAudioElement }>({});
    
    // --- Efeitos ---

    // Carregamento de sons e tela cheia
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
             Object.values(sounds.current).forEach(sound => {
                if (sound && !sound.paused) { sound.pause(); sound.currentTime = 0; }
            });
        };
    }, []);

    // Conexão com Firebase
    useEffect(() => {
        if (!isReady) return;

        const templatesRef = ref(database, 'message_templates');
        const unsubTemplates = onValue(templatesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const mergedTemplates = { ...initialTemplates };
                for (const key in mergedTemplates) {
                    if (data[key]) {
                        mergedTemplates[key] = {
                            ...mergedTemplates[key],
                            ...data[key],
                            styles: {
                                ...mergedTemplates[key].styles,
                                ...data[key].styles,
                            },
                             enabled: data[key].enabled !== undefined ? data[key].enabled : true,
                        }
                    }
                }
                setTemplates(mergedTemplates);
            }
        });

        const disputeStateRef = ref(database, 'dispute/state');
        const unsubDispute = onValue(disputeStateRef, (snapshot) => {
            const newAction: DisputeAction | null = snapshot.val();
            
            if (newAction?.type && templates[newAction.type.toLowerCase()]?.enabled === false) {
                 // Se a mensagem está desabilitada, não a processa
                 if (currentAction?.type === newAction.type) return;
                 setCurrentAction(newAction); // Atualiza para evitar re-processamento
                 return;
            }

            setCurrentAction(prevAction => {
                handleAction(newAction, prevAction);
                return newAction;
            });
        });

        return () => {
            unsubTemplates();
            unsubDispute();
            stopAllSounds();
            stopShufflingAnimation();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, templates]); // Adicionado `templates` como dependência

    // --- Funções de Controle ---
    
    const playSound = (soundFile: string, loop = false) => {
        stopAllSounds();
        const soundToPlay = sounds.current[soundFile];
        if (soundToPlay) {
            soundToPlay.loop = loop;
            soundToPlay.play().catch(e => {
              if (e.name !== 'AbortError') { console.error("Erro ao tocar áudio:", e); }
            });
        }
    };

    const stopAllSounds = () => {
        Object.values(sounds.current).forEach(sound => {
            if (sound && !sound.paused) { sound.pause(); sound.currentTime = 0; }
        });
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

    const handleAction = (action: DisputeAction | null, prevAction: DisputeAction | null) => {
        const previousActionType = prevAction?.type;

        if (!action) {
            resetToIdle();
            return;
        }

        // Play sound only on state transition
        if (action.type !== previousActionType) {
            switch (action.type) {
                case 'SHUFFLING_PARTICIPANTS':
                     if (!shufflingIntervalRef.current) {
                        startShufflingAnimation(action.payload?.activeParticipants || []);
                    }
                    break;
                case 'UPDATE_PARTICIPANTS':
                    stopShufflingAnimation();
                    if (!participantA && action.payload?.participantA) playSound('sinos.mp3');
                    break;
                case 'SHOW_WORD':
                    playSound('premio.mp3');
                    break;
                case 'NO_WORD_WINNER':
                    playSound('erro.mp3');
                    break;
                case 'WORD_WINNER':
                case 'DUEL_WINNER':
                case 'FINAL_WINNER':
                case 'TIE_ANNOUNCEMENT':
                    playSound('vencedor.mp3');
                    break;
                case 'RESET':
                    resetToIdle();
                    break;
            }
        }


        switch (action.type) {
            case 'RESET':
                resetToIdle();
                break;
            
            case 'SHUFFLING_PARTICIPANTS':
                setShowDuelContent(true);
                setShowWord(false);
                setWords([]);
                setDuelScore({ a: 0, b: 0 });
                break;

            case 'UPDATE_PARTICIPANTS':
                setShowDuelContent(true);
                setParticipantA(action.payload?.participantA || null);
                setParticipantB(action.payload?.participantB || null);
                setDuelScore(action.payload?.duelScore || { a: 0, b: 0 });
                break;

            case 'SHOW_WORD':
                if (action.payload && action.payload.words) {
                    setWords(action.payload.words);
                    setShowWord(true);
                }
                break;

            case 'HIDE_WORD':
                setShowWord(false);
                break;
            
            case 'NO_WORD_WINNER':
            case 'WORD_WINNER':
            case 'DUEL_WINNER':
            case 'FINAL_WINNER':
            case 'TIE_ANNOUNCEMENT':
            case 'SHOW_MESSAGE':
            case 'NO_WINNER':
                setShowDuelContent(false);
                setShowWord(false);
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
        setShowDuelContent(true);
    };

    const startShufflingAnimation = (participants: Participant[]) => {
        stopShufflingAnimation();
        playSound('tambor.mp3', true);
        shufflingIntervalRef.current = setInterval(() => {
            const shuffled = [...participants].sort(() => 0.5 - Math.random());
            setParticipantA(shuffled[0] || null);
            setParticipantB(shuffled[1] || null);
        }, 150);
    };

    const shouldShowMessage = currentAction && templates[currentAction.type.toLowerCase()]?.enabled && ['WORD_WINNER', 'DUEL_WINNER', 'FINAL_WINNER', 'TIE_ANNOUNCEMENT', 'NO_WORD_WINNER', 'NO_WINNER', 'SHOW_MESSAGE'].includes(currentAction.type);

    const DynamicMessageContent = ({ template, payload }: { template: MessageTemplate; payload: any; }) => {
        const { text, styles } = template;
        
        let processedText = text;
        const data = {
            name: payload.winner?.name || payload.finalWinner?.name || '',
            words: Array.isArray(payload.duelWordsWon) ? payload.duelWordsWon.join(', ') : '',
            'words.0': Array.isArray(payload.words) && payload.words.length > 0 ? payload.words[0] : '',
            stars: payload.winner?.stars || payload.finalWinner?.stars || 0,
            ...payload
        };
        
        if (Array.isArray(data.participants)) {
             processedText = processedText.replace(/\{\{\{\s*participantsList\s*\}\}\}/g, (data.participants as Participant[]).map((p: Participant) => `<div style="background-color: ${styles.highlightColor}; color: ${styles.highlightTextColor}; padding: 0.5em 1em; border-radius: 0.5em; font-size: 1.5rem; font-weight: bold;">${p.name}</div>`).join(''));
        }

        processedText = processedText.replace(/\{\{\s*name\s*\}\}/g, data.name);
        processedText = processedText.replace(/\{\{\s*words\.0\s*\}\}/g, data['words.0']);
        processedText = processedText.replace(/\{\{\s*words\s*\}\}/g, data.words);
        processedText = processedText.replace(/\{\{\s*stars\s*\}\}/g, String(data.stars));
        
        const highlightStyle = `background-color: ${styles.highlightColor}; color: ${styles.highlightTextColor}; padding: 0.2em 0.5em; border-radius: 0.3em; display: inline-block;`;
        processedText = processedText.replace(/<b>/g, `<b style="${highlightStyle}">`);
      
        return <div className={cn(styles.fontFamily === 'Melison' ? 'font-melison' : 'font-subjectivity')} dangerouslySetInnerHTML={{ __html: processedText }} />;
    };

    // --- Componentes de Renderização ---
    const renderMessage = () => {
      if (!shouldShowMessage || !currentAction) return null;
  
      const templateKey = currentAction.type.toLowerCase();
      const template = templates[templateKey];
      const payload = currentAction.payload || {};
  
      if (!template) return null;
  
      const { styles } = template;
      
      const containerStyle: React.CSSProperties = {
          background: styles.backgroundColor,
          color: styles.textColor,
          border: `${styles.borderWidth} solid ${styles.borderColor}`,
          borderRadius: styles.borderRadius,
          fontFamily: styles.fontFamily,
          fontSize: styles.fontSize,
          padding: '4rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          textAlign: 'center',
          maxWidth: '60rem',
      } as React.CSSProperties;
  
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 p-8 z-20">
              <div style={containerStyle}>
                  <DynamicMessageContent template={template} payload={payload} />
              </div>
          </div>
      );
    };

    const renderDuelContent = () => (
        <div className={cn(
            "relative text-center text-white w-full flex-1 flex flex-col justify-center items-center overflow-hidden transition-opacity duration-500",
            !showDuelContent ? 'opacity-0' : 'opacity-100'
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
                        <p className="text-4xl font-bold mt-4">Pontos: {duelScore?.a || 0}</p>
                    </div>
                    <div className="flex-shrink-0 text-center px-4">
                        <h3 className="text-8xl font-bold font-melison">Vs.</h3>
                    </div>
                    <div className="flex-1 text-center">
                        <h3 className="text-5xl font-bold text-accent font-subjectivity break-words line-clamp-2">{participantB?.name || 'Participante B'}</h3>
                         <p className="text-4xl font-bold mt-4">Pontos: {duelScore?.b || 0}</p>
                    </div>
                </div>
            </div>
        </div>
    );

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
        <div className="projetado-page h-screen w-screen overflow-hidden relative flex flex-col items-center justify-center">
            <GlobalStyle />
            <header className="flex items-center gap-4 text-accent py-4">
                <h1 className="text-8xl font-melison font-bold tracking-tight">Spelling Bee</h1>
                <Image src="/images/Bee.gif" alt="Bee Icon" width={100} height={100} unoptimized />
            </header>
            {renderDuelContent()}
            {renderMessage()}
        </div>
    );
}

// Adicionar alguns estilos globais para o conteúdo dinâmico
const GlobalStyle = () => (
  <style jsx global>{`
    .dynamic-message-content h1,
    .dynamic-message-content h2,
    .dynamic-message-content p {
      margin: 0;
      line-height: 1.4;
    }
    .dynamic-message-content h1 {
      font-size: 5rem;
      font-weight: 900;
    }
    .dynamic-message-content h2 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    .dynamic-message-content p {
      /* Font size is now controlled by inline style */
    }
    .dynamic-message-content i {
        display: block;
        font-size: 0.8em;
        margin: 0.5em 0;
        font-style: italic;
    }
    .dynamic-message-content .icon {
        font-size: 8rem;
        display: block;
        margin: 1rem auto;
    }
    .dynamic-message-content .participants {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: center;
    }
  `}</style>
);
