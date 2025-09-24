'use client';

import { useState, useEffect } from 'react';
import type { Participant } from '@/app/page';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

type DisputeState = {
    type: 'UPDATE_PARTICIPANTS' | 'SHOW_WORD' | 'HIDE_WORD' | 'ROUND_WINNER' | 'FINAL_WINNER' | 'RESET';
    participantA?: Participant | null;
    participantB?: Participant | null;
    word?: string | null;
    winner?: Participant | null;
    loser?: Participant | null;
    finalWinner?: Participant | null;
}

const getInitialState = () => ({
    participantA: null,
    participantB: null,
    word: null,
    showWord: false,
    winnerMessage: null,
    finalWinner: null,
});

export default function ProjectionPage() {
    const [participantA, setParticipantA] = useState<Participant | null>(null);
    const [participantB, setParticipantB] = useState<Participant | null>(null);
    const [word, setWord] = useState<string | null>(null);
    const [showWord, setShowWord] = useState(false);
    const [winnerMessage, setWinnerMessage] = useState<{ winner?: Participant, loser?: Participant, word?: string} | null>(null);
    const [finalWinner, setFinalWinner] = useState<Participant | null>(null);

    const [animationKey, setAnimationKey] = useState(0);

    useEffect(() => {
        const disputeStateRef = ref(database, 'dispute/state');

        const unsubscribe = onValue(disputeStateRef, (snapshot) => {
            const action: DisputeState = snapshot.val();

            if (!action) {
                const s = getInitialState();
                setParticipantA(s.participantA);
                setParticipantB(s.participantB);
                setWord(s.word);
                setShowWord(s.showWord);
                setWinnerMessage(s.winnerMessage);
                setFinalWinner(s.finalWinner);
                return;
            };

            switch (action.type) {
                case 'RESET':
                    setAnimationKey(0);
                    const s = getInitialState();
                    setParticipantA(s.participantA);
                    setParticipantB(s.participantB);
                    setWord(s.word);
                    setShowWord(s.showWord);
                    setWinnerMessage(s.winnerMessage);
                    setFinalWinner(s.finalWinner);
                    break;
                case 'UPDATE_PARTICIPANTS':
                    setParticipantA(action.participantA || null);
                    setParticipantB(action.participantB || null);
                    setWord(null);
                    setShowWord(false);
                    setWinnerMessage(null);
                    setFinalWinner(null);
                    break;
                case 'SHOW_WORD':
                    setWord(action.word || null);
                    setShowWord(true);
                    setWinnerMessage(null);
                    break;
                case 'HIDE_WORD':
                     setShowWord(false);
                     setWord(null);
                     setWinnerMessage(null);
                     break;
                case 'ROUND_WINNER':
                    setAnimationKey(prev => prev + 1);
                    setShowWord(false);
                    setWinnerMessage({ winner: action.winner, loser: action.loser, word: action.word });
                    break;
                case 'FINAL_WINNER':
                    setAnimationKey(prev => prev + 1);
                    const finalState = getInitialState();
                    setParticipantA(finalState.participantA);
                    setParticipantB(finalState.participantB);
                    setWord(finalState.word);
                    setShowWord(finalState.showWord);
                    setWinnerMessage(finalState.winnerMessage);
                    setFinalWinner(action.finalWinner || null);
                    break;
            }
        });

        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if(winnerMessage) {
            const timer = setTimeout(() => {
                setWinnerMessage(null);
            }, 10000); // show for 10 seconds
            return () => clearTimeout(timer);
        }
    }, [winnerMessage]);


    const MainContent = () => (
        <div id="main-content" className={cn("flex flex-col items-center justify-center w-full h-full transition-all duration-500", (winnerMessage || finalWinner) ? 'opacity-0' : 'opacity-100')}>
            <header className="flex items-center gap-4 text-white">
                 <h1 id="titulo-projetado" className="text-7xl font-bold tracking-tight">
                    Disputa de Soletração
                </h1>
                <Image src="/bee.gif" alt="Bee Icon" width={100} height={100} unoptimized id="bee-icon" />
            </header>

            <div id="Psorteio-box" className="mt-12 text-center text-white">
                <h2 id="Sbtitulo" className="text-4xl font-semibold">A Palavra é</h2>
                <div id="premio-box" className={cn("mt-4 h-32 flex items-center justify-center", !showWord && 'invisible')}>
                    <p id="premioSorteado" className="text-8xl font-bold uppercase tracking-[0.2em]">
                        {word || '...'}
                    </p>
                </div>
                <div id="disputa" className="mt-12 flex items-center justify-center gap-16">
                    <div id="participanteA" className="text-center">
                        <h3 id="nomeA" className="text-6xl font-bold">{participantA?.name || 'Participante A'}</h3>
                    </div>
                    <h3 className="text-7xl font-bold mx-8">Vs.</h3>
                    <div id="participanteB" className="text-center">
                        <h3 id="nomeB" className="text-6xl font-bold">{participantB?.name || 'Participante B'}</h3>
                    </div>
                </div>
            </div>
        </div>
    );
    
    const WinnerMessage = () => {
         if (!winnerMessage) return null;
         const { winner, word: winnerWord } = winnerMessage;

        return (
            <div key={animationKey} className="animate-in fade-in zoom-in-95 duration-1000">
                <div id="mensagem-vencedor" className="fixed inset-0 flex items-center justify-center bg-transparent z-50">
                    <div className="bg-white/95 text-purple-800 border-8 border-yellow-400 rounded-2xl p-16 shadow-2xl text-center max-w-4xl mx-auto">
                         <div className="text-6xl mb-4">
                            <b className="text-white bg-purple-700 px-6 py-2 rounded-lg whitespace-nowrap inline-block shadow-lg">{winner?.name}</b>
                        </div>
                         <p className="text-5xl leading-tight">
                            Ganhou a disputa soletrando
                             <br/> 
                            <b className="text-white bg-purple-700 px-4 py-1 rounded-lg shadow-md mx-2">{winnerWord}</b>
                            <br/> 
                            e recebeu uma <span className="text-yellow-400 text-6xl">⭐</span>!
                        </p>
                    </div>
                </div>
            </div>
        );
    }
    
    const FinalWinnerMessage = () => {
         if (!finalWinner) return null;

        return (
             <div key={animationKey} className="animate-in fade-in zoom-in-95 duration-1000">
                <div id="mensagem-final-vencedor" className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
                    <div className="bg-gradient-to-br from-yellow-300 to-amber-500 text-purple-900 border-8 border-white rounded-3xl p-20 shadow-2xl text-center max-w-5xl mx-auto relative overflow-hidden">
                        <Crown className="absolute -top-16 -left-16 w-64 h-64 text-white/20 -rotate-12" />
                        <Crown className="absolute -bottom-20 -right-16 w-72 h-72 text-white/20 rotate-12" />
                        <h2 className="text-6xl font-black uppercase tracking-wider">Temos um Vencedor!</h2>
                        <Crown className="w-48 h-48 mx-auto my-8 text-white drop-shadow-lg" />
                        <p className="text-8xl font-black tracking-wide text-white bg-purple-800/80 px-8 py-4 rounded-xl shadow-inner">{finalWinner.name}</p>
                        <p className="mt-8 text-5xl font-bold flex items-center justify-center gap-4">
                            Com {finalWinner.stars} <span className="text-white text-6xl">⭐</span>
                        </p>
                    </div>
                </div>
            </div>
        )
    }


    return (
        <div className="bg-purple-900 h-screen w-screen overflow-hidden relative">
            <MainContent />
            <WinnerMessage />
            <FinalWinnerMessage />
        </div>
    );
}
