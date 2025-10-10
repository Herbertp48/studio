
'use client';

import React, { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { database } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Simplified template structure for a form-based approach
export type DesignTemplate = {
  text1: string;
  text2: string;
  text3: string;
  text1Color: string;
  text2Color: string;
  text3Color: string;
  text1FontSize: number;
  text2FontSize: number;
  text3FontSize: number;
  backgroundColor: string;
};

export type AllDesigns = {
  word_winner: DesignTemplate;
  duel_winner: DesignTemplate;
  no_word_winner: DesignTemplate;
  final_winner: DesignTemplate;
  tie_announcement: DesignTemplate;
};

const TEMPLATE_KEYS: (keyof AllDesigns)[] = [
  'word_winner', 'duel_winner', 'no_word_winner', 
  'final_winner', 'tie_announcement'
];

const TEMPLATE_LABELS: { [key in keyof AllDesigns]: string } = {
  word_winner: 'Vencedor da Palavra',
  duel_winner: 'Vencedor do Duelo',
  no_word_winner: 'Rodada sem Vencedor',
  final_winner: 'Vencedor Final',
  tie_announcement: 'Anúncio de Empate',
};

// Provides default values for all templates
const getInitialDesigns = (): AllDesigns => ({
  word_winner: {
    text1: '{{name}}',
    text2: 'acertou a palavra',
    text3: '"{{words.0}}"',
    text1Color: '#6d21db',
    text2Color: '#6d21db',
    text3Color: '#000000',
    text1FontSize: 100,
    text2FontSize: 50,
    text3FontSize: 80,
    backgroundColor: '#fffbe6',
  },
  duel_winner: {
    text1: '⭐ {{name}} ⭐',
    text2: 'venceu o duelo!',
    text3: '',
    text1Color: '#6d21db',
    text2Color: '#6d21db',
    text3Color: '#000000',
    text1FontSize: 100,
    text2FontSize: 60,
    text3FontSize: 40,
    backgroundColor: '#fffbe6',
  },
  no_word_winner: {
    text1: 'Ninguém acertou a palavra',
    text2: '"{{words.0}}"',
    text3: '',
    text1Color: '#b91c1c',
    text2Color: '#b91c1c',
    text3Color: '#000000',
    text1FontSize: 60,
    text2FontSize: 70,
    text3FontSize: 40,
    backgroundColor: '#fecaca',
  },
  final_winner: {
    text1: 'O Grande Campeão é',
    text2: '{{name}}',
    text3: 'Com {{stars}} ⭐',
    text1Color: '#4c1d95',
    text2Color: '#ffffff',
    text3Color: '#4c1d95',
    text1FontSize: 60,
    text2FontSize: 130,
    text3FontSize: 50,
    backgroundColor: '#fde047',
  },
  tie_announcement: {
    text1: '🛡️ EMPATE! 🛡️',
    text2: 'Rodada de desempate entre:',
    text3: '{{{participantsList}}}',
    text1Color: '#4338ca',
    text2Color: '#3730a3',
    text3Color: '#3730a3',
    text1FontSize: 90,
    text2FontSize: 50,
    text3FontSize: 40,
    backgroundColor: '#e0e7ff',
  },
});

function StudioPageContent() {
  const [designs, setDesigns] = useState<AllDesigns>(getInitialDesigns);
  const [activeTemplate, setActiveTemplate] = useState<keyof AllDesigns>('word_winner');
  const { toast } = useToast();

  useEffect(() => {
    const designsRef = ref(database, 'designs');
    const unsubscribe = onValue(designsRef, (snapshot) => {
        const dataFromDb = snapshot.val();
        if (dataFromDb) {
            // Merge DB data with initial defaults to ensure all fields are present
            setDesigns(prevDesigns => {
                const updatedDesigns = { ...prevDesigns };
                for (const key of TEMPLATE_KEYS) {
                    if (dataFromDb[key]) {
                        updatedDesigns[key] = { ...prevDesigns[key], ...dataFromDb[key] };
                    }
                }
                return updatedDesigns;
            });
        }
    });

    return () => unsubscribe();
  }, []);

  const handleTemplateChange = (key: keyof AllDesigns, field: keyof DesignTemplate, value: string | number) => {
    setDesigns(prev => ({
        ...prev,
        [key]: {
            ...prev[key],
            [field]: value
        }
    }));
  };

  const handleSaveDesigns = () => {
    set(ref(database, 'designs'), designs)
        .then(() => toast({ title: 'Sucesso!', description: `Designs salvos com sucesso.` }))
        .catch(err => toast({ variant: 'destructive', title: 'Erro', description: err.message }));
  };

  const currentTemplateData = designs[activeTemplate];

  return (
    <div className="flex flex-col w-full h-screen bg-muted/40 text-foreground overflow-hidden">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
            <CardHeader>
                <CardTitle>Editor de Modelos de Projeção</CardTitle>
                <CardDescription>
                    Personalize as mensagens que aparecem na tela de projeção. 
                    Use variáveis como `{{name}}` para nomes, `{{words.0}}` para palavras e `{{stars}}` para estrelas. 
                    `{{{participantsList}}}` é usado para listar os participantes no empate.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <aside className="md:col-span-1 flex flex-col gap-2">
                        {TEMPLATE_KEYS.map(key => (
                            <Button
                                key={key}
                                variant={activeTemplate === key ? 'secondary' : 'ghost'}
                                onClick={() => setActiveTemplate(key)}
                                className="justify-start"
                            >
                                {TEMPLATE_LABELS[key]}
                            </Button>
                        ))}
                         <Button onClick={handleSaveDesigns} className="mt-4">Salvar Todas as Alterações</Button>
                    </aside>

                    {/* Form */}
                    <div className="md:col-span-3">
                        {currentTemplateData && (
                            <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger>Conteúdo de Texto</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-4">
                                        <div>
                                            <Label htmlFor="text1">Texto Principal</Label>
                                            <Input id="text1" value={currentTemplateData.text1} onChange={e => handleTemplateChange(activeTemplate, 'text1', e.target.value)} />
                                        </div>
                                        <div>
                                            <Label htmlFor="text2">Texto Secundário</Label>
                                            <Input id="text2" value={currentTemplateData.text2} onChange={e => handleTemplateChange(activeTemplate, 'text2', e.target.value)} />
                                        </div>
                                        <div>
                                            <Label htmlFor="text3">Texto Adicional/Variável</Label>
                                            <Input id="text3" value={currentTemplateData.text3} onChange={e => handleTemplateChange(activeTemplate, 'text3', e.target.value)} />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-2">
                                    <AccordionTrigger>Estilo e Cores</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="text1FontSize">Tam. Fonte Principal</Label>
                                                <Input id="text1FontSize" type="number" value={currentTemplateData.text1FontSize} onChange={e => handleTemplateChange(activeTemplate, 'text1FontSize', Number(e.target.value))} />
                                            </div>
                                            <div className="flex flex-col">
                                                <Label htmlFor="text1Color">Cor Fonte Principal</Label>
                                                <Input id="text1Color" type="color" value={currentTemplateData.text1Color} onChange={e => handleTemplateChange(activeTemplate, 'text1Color', e.target.value)} className="h-10"/>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="text2FontSize">Tam. Fonte Secundária</Label>
                                                <Input id="text2FontSize" type="number" value={currentTemplateData.text2FontSize} onChange={e => handleTemplateChange(activeTemplate, 'text2FontSize', Number(e.target.value))} />
                                            </div>
                                             <div className="flex flex-col">
                                                <Label htmlFor="text2Color">Cor Fonte Secundária</Label>
                                                <Input id="text2Color" type="color" value={currentTemplateData.text2Color} onChange={e => handleTemplateChange(activeTemplate, 'text2Color', e.target.value)} className="h-10"/>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="text3FontSize">Tam. Fonte Adicional</Label>
                                                <Input id="text3FontSize" type="number" value={currentTemplateData.text3FontSize} onChange={e => handleTemplateChange(activeTemplate, 'text3FontSize', Number(e.target.value))} />
                                            </div>
                                            <div className="flex flex-col">
                                                <Label htmlFor="text3Color">Cor Fonte Adicional</Label>
                                                <Input id="text3Color" type="color" value={currentTemplateData.text3Color} onChange={e => handleTemplateChange(activeTemplate, 'text3Color', e.target.value)} className="h-10"/>
                                            </div>
                                        </div>
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="flex flex-col">
                                                <Label htmlFor="backgroundColor">Cor de Fundo</Label>
                                                <Input id="backgroundColor" type="color" value={currentTemplateData.backgroundColor} onChange={e => handleTemplateChange(activeTemplate, 'backgroundColor', e.target.value)} className="h-10"/>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}


export default function StudioPage() {
    return (
        <ProtectedRoute page="admin">
            <StudioPageContent />
        </ProtectedRoute>
    );
}
