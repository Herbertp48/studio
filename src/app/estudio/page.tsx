'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { database } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from '@/components/ui/separator';

type TemplateStyle = {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: string;
    borderRadius: string;
};

type MessageTemplate = {
    text: string;
    styles: TemplateStyle;
};

type MessageTemplates = {
    [key: string]: MessageTemplate;
};

const templateLabels: { [key: string]: { title: string, description: string, variables: string[] } } = {
    word_winner: {
        title: "Vencedor da Palavra",
        description: "Exibida quando um participante acerta uma palavra e ganha um ponto no duelo.",
        variables: ["{{name}}", "{{words.0}}"]
    },
    duel_winner: {
        title: "Vencedor do Duelo",
        description: "Exibida quando um participante vence o duelo completo e ganha uma estrela.",
        variables: ["{{name}}", "{{words}}"]
    },
    no_word_winner: {
        title: "Rodada sem Vencedor",
        description: "Exibida quando nenhum dos participantes acerta a palavra da rodada.",
        variables: ["{{words.0}}"]
    },
    final_winner: {
        title: "Vencedor Final da Disputa",
        description: "Exibida ao final da competição, coroando o grande campeão.",
        variables: ["{{name}}", "{{stars}}"]
    },
    tie_announcement: {
        title: "Anúncio de Empate",
        description: "Exibida quando há um empate no final da disputa, anunciando a rodada de desempate.",
        variables: ["{{#each participants}} {{this.name}} {{/each}}"]
    }
};

const initialTemplates: MessageTemplates = {
    word_winner: {
        text: '<b>{{name}}</b> ganhou a disputa soletrando corretamente a palavra <b>{{words.0}}</b> e marcou um ponto!',
        styles: { backgroundColor: '#fffbe6', textColor: '#6d21db', borderColor: '#fdc244', borderWidth: '8px', borderRadius: '20px' }
    },
    duel_winner: {
        text: '<b>{{name}}</b> ganhou o duelo soletrando: <br><i>{{words}}</i><br> e ganhou uma <b>estrela ⭐</b>!',
        styles: { backgroundColor: '#fffbe6', textColor: '#6d21db', borderColor: '#fdc244', borderWidth: '8px', borderRadius: '20px' }
    },
    no_word_winner: {
        text: '<h2>Rodada sem Vencedor</h2>Ninguém pontuou com a palavra <b>{{words.0}}</b>.',
        styles: { backgroundColor: '#fffbe6', textColor: '#b91c1c', borderColor: '#ef4444', borderWidth: '8px', borderRadius: '20px' }
    },
     final_winner: {
        text: '<h2>Temos um Vencedor!</h2><p class="crown">👑</p><h1>{{name}}</h1><p>Com {{stars}} ⭐</p>',
        styles: { backgroundColor: 'linear-gradient(to bottom right, #fde047, #f59e0b)', textColor: '#4c1d95', borderColor: '#ffffff', borderWidth: '8px', borderRadius: '24px' }
    },
     tie_announcement: {
        text: '<h2>Temos um Empate!</h2><p>Os seguintes participantes irão para a rodada de desempate:</p><div class="participants">{{#each participants}}<div>{{this.name}}</div>{{/each}}</div>',
        styles: { backgroundColor: '#fffbe6', textColor: '#6d21db', borderColor: '#fdc244', borderWidth: '8px', borderRadius: '20px' }
    },
};

const renderPreview = (template: MessageTemplate) => {
    const { text, styles } = template;

    const dummyData = {
        name: 'PARTICIPANTE',
        words: ['PALAVRA-1', 'PALAVRA-2'],
        'words.0': 'PALAVRA-EXEMPLO',
        stars: '5',
        participants: [{ name: 'JOÃO' }, { name: 'MARIA' }]
    };

    let renderedText = text;
    // Basic replacement for preview
    renderedText = renderedText.replace(/\{\{name\}\}/g, dummyData.name);
    renderedText = renderedText.replace(/\{\{words\.0\}\}/g, dummyData['words.0']);
    renderedText = renderedText.replace(/\{\{words\}\}/g, dummyData.words.join(', '));
    renderedText = renderedText.replace(/\{\{stars\}\}/g, dummyData.stars);
    
    const eachRegex = /\{\{#each participants\}\}(.*?)\{\{\/each\}\}/gs;
    renderedText = renderedText.replace(eachRegex, (match, innerTemplate) => {
        if (!Array.isArray(dummyData.participants)) return '';
        return dummyData.participants.map((p: any) => innerTemplate.replace(/\{\{this\.name\}\}/g, p.name)).join('');
    });


    const style: React.CSSProperties = {
        background: styles.backgroundColor,
        color: styles.textColor,
        border: `${styles.borderWidth} solid ${styles.borderColor}`,
        borderRadius: styles.borderRadius,
        padding: '2rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '100%',
        wordBreak: 'break-word',
    };

    return (
        <div className='p-4 border bg-muted rounded-lg mt-4'>
             <Label className='font-bold text-sm text-muted-foreground'>PRÉ-VISUALIZAÇÃO</Label>
            <div className='flex justify-center items-center p-4 mt-2'>
                <div style={style}>
                    <div dangerouslySetInnerHTML={{ __html: renderedText }} />
                </div>
            </div>
        </div>
    );
};


function StudioPageContent() {
    const [templates, setTemplates] = useState<MessageTemplates>(initialTemplates);
    const { toast } = useToast();

    useEffect(() => {
        const templatesRef = ref(database, 'message_templates');
        const unsubscribe = onValue(templatesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Merge initial templates with fetched data to ensure all keys exist
                setTemplates(prev => ({...initialTemplates, ...data}));
            }
        });
        return () => unsubscribe();
    }, []);

    const handleStyleChange = (templateKey: string, styleKey: keyof TemplateStyle, value: string) => {
        setTemplates(prev => ({
            ...prev,
            [templateKey]: {
                ...prev[templateKey],
                styles: {
                    ...prev[templateKey].styles,
                    [styleKey]: value
                }
            }
        }));
    };

    const handleTextChange = (templateKey: string, value: string) => {
        setTemplates(prev => ({
            ...prev,
            [templateKey]: {
                ...prev[templateKey],
                text: value
            }
        }));
    };

    const handleSaveChanges = (templateKey: string) => {
        const templateToSave = templates[templateKey];
        const updates: { [key: string]: MessageTemplate } = {};
        updates[`/message_templates/${templateKey}`] = templateToSave;

        update(ref(database), updates)
            .then(() => {
                toast({ title: "Sucesso!", description: `Template "${templateLabels[templateKey].title}" salvo com sucesso.` });
            })
            .catch((error) => {
                toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
            });
    };

    return (
        <div className="flex flex-col w-full bg-background text-foreground">
            <AppHeader />
            <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Estúdio de Projeção</CardTitle>
                        <CardDescription>Personalize as mensagens e o visual que aparecem na tela de projeção.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {Object.keys(templates).map((key) => {
                                const template = templates[key];
                                if (!template) return null; // Safety check
                                return (
                                <AccordionItem key={key} value={key}>
                                    <AccordionTrigger className="text-lg font-semibold">{templateLabels[key]?.title || key}</AccordionTrigger>
                                    <AccordionContent className="space-y-6 pt-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Label htmlFor={`text-${key}`} className="font-bold">Texto da Mensagem</Label>
                                                 <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Variáveis disponíveis: {templateLabels[key]?.variables.join(', ')}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <textarea
                                                id={`text-${key}`}
                                                value={template.text}
                                                onChange={(e) => handleTextChange(key, e.target.value)}
                                                className="w-full min-h-[100px] p-2 border rounded-md font-mono text-sm"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">{templateLabels[key]?.description}</p>
                                        </div>

                                        <Separator/>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`bgColor-${key}`}>Cor de Fundo</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="color"
                                                        id={`bgColor-picker-${key}`}
                                                        value={template.styles.backgroundColor.startsWith('linear-gradient') ? '#ffffff' : template.styles.backgroundColor}
                                                        onChange={(e) => handleStyleChange(key, 'backgroundColor', e.target.value)}
                                                        className="p-1 h-10 w-10"
                                                    />
                                                    <Input
                                                        id={`bgColor-${key}`}
                                                        value={template.styles.backgroundColor}
                                                        onChange={(e) => handleStyleChange(key, 'backgroundColor', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor={`textColor-${key}`}>Cor do Texto</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="color"
                                                        id={`textColor-picker-${key}`}
                                                        value={template.styles.textColor}
                                                        onChange={(e) => handleStyleChange(key, 'textColor', e.target.value)}
                                                        className="p-1 h-10 w-10"
                                                    />
                                                    <Input
                                                        id={`textColor-${key}`}
                                                        value={template.styles.textColor}
                                                        onChange={(e) => handleStyleChange(key, 'textColor', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`borderColor-${key}`}>Cor da Borda</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="color"
                                                        id={`borderColor-picker-${key}`}
                                                        value={template.styles.borderColor}
                                                        onChange={(e) => handleStyleChange(key, 'borderColor', e.target.value)}
                                                        className="p-1 h-10 w-10"
                                                    />
                                                    <Input
                                                        id={`borderColor-${key}`}
                                                        value={template.styles.borderColor}
                                                        onChange={(e) => handleStyleChange(key, 'borderColor', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor={`borderWidth-${key}`}>Largura da Borda</Label>
                                                <Input
                                                    id={`borderWidth-${key}`}
                                                    value={template.styles.borderWidth}
                                                    onChange={(e) => handleStyleChange(key, 'borderWidth', e.target.value)}
                                                    placeholder="ex: 8px"
                                                />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor={`borderRadius-${key}`}>Raio da Borda</Label>
                                                <Input
                                                    id={`borderRadius-${key}`}
                                                    value={template.styles.borderRadius}
                                                    onChange={(e) => handleStyleChange(key, 'borderRadius', e.target.value)}
                                                     placeholder="ex: 20px"
                                                />
                                            </div>
                                        </div>

                                        {renderPreview(template)}

                                        <Button onClick={() => handleSaveChanges(key)} className='mt-4'>Salvar Template</Button>
                                    </AccordionContent>
                                </AccordionItem>
                            )})}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
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
