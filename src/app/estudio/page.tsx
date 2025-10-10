
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { database } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text, Image as ImageIcon, Trash2, Layers, Download, Square, Star, Circle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';


export type EditorElement = {
  id: string;
  type: 'text' | 'image' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  content?: string;
  fontSize?: number;
  fontWeight?: '400' | '700' | '900';
  fontFamily?: string;
  color?: string;
  src?: string;
  shape?: 'rect' | 'circle' | 'star';
  background?: string;
};

export type Design = {
  id: string;
  name: string;
  canvas: {
    width: number;
    height: number;
    background: string;
  };
  elements: EditorElement[];
};

const TEMPLATE_KEYS = [
  'word_winner', 'duel_winner', 'no_word_winner', 
  'final_winner', 'tie_announcement'
];

const TEMPLATE_LABELS: { [key: string]: string } = {
  word_winner: 'Vencedor da Palavra',
  duel_winner: 'Vencedor do Duelo',
  no_word_winner: 'Rodada sem Vencedor',
  final_winner: 'Vencedor Final',
  tie_announcement: 'Anúncio de Empate',
};

const getInitialDesigns = (): { [key: string]: Design } => ({
  word_winner: {
    id: 'word_winner',
    name: 'Vencedor da Palavra',
    canvas: { width: 1200, height: 600, background: '#fffbe6' },
    elements: [
      { id: 'ww-el-1', type: 'text', content: '{{name}}', x: 50, y: 150, width: 1100, height: 120, rotation: 0, z: 1, fontSize: 100, fontFamily: 'Melison', fontWeight: '700', color: '#6d21db' },
      { id: 'ww-el-2', type: 'text', content: 'acertou a palavra', x: 50, y: 280, width: 1100, height: 60, rotation: 0, z: 2, fontSize: 50, fontFamily: 'Subjectivity', fontWeight: '700', color: '#6d21db' },
      { id: 'ww-el-3', type: 'text', content: '"{{words.0}}"', x: 50, y: 350, width: 1100, height: 100, rotation: 0, z: 3, fontSize: 80, fontFamily: 'Subjectivity', fontWeight: '900', color: '#000000' },
    ],
  },
  duel_winner: {
    id: 'duel_winner',
    name: 'Vencedor do Duelo',
    canvas: { width: 1200, height: 600, background: '#fffbe6' },
    elements: [
        { id: 'dw-el-1', type: 'text', content: '⭐', x: 50, y: 50, width: 100, height: 100, rotation: -15, z: 1, fontSize: 100, color: '#FACC15' },
        { id: 'dw-el-2', type: 'text', content: '{{name}}', x: 50, y: 150, width: 1100, height: 120, rotation: 0, z: 2, fontSize: 100, fontFamily: 'Melison', fontWeight: '700', color: '#6d21db' },
        { id: 'dw-el-3', type: 'text', content: 'venceu o duelo!', x: 50, y: 280, width: 1100, height: 60, rotation: 0, z: 3, fontSize: 50, fontFamily: 'Subjectivity', fontWeight: '700', color: '#6d21db' },
    ],
  },
   no_word_winner: {
    id: 'no_word_winner',
    name: 'Rodada sem Vencedor',
    canvas: { width: 1200, height: 600, background: '#fecaca' },
    elements: [
        { id: 'nww-el-1', type: 'text', content: 'Ninguém acertou a palavra "{{words.0}}"', x: 50, y: 250, width: 1100, height: 100, rotation: 0, z: 1, fontSize: 60, fontFamily: 'Subjectivity', fontWeight: '700', color: '#b91c1c' },
    ],
  },
   final_winner: {
    id: 'final_winner',
    name: 'Vencedor Final',
    canvas: { width: 1200, height: 700, background: 'linear-gradient(to bottom right, #fde047, #f59e0b)' },
    elements: [
        { id: 'fw-el-1', type: 'text', content: '👑', x: 50, y: 50, width: 200, height: 200, rotation: 0, z: 1, fontSize: 150 },
        { id: 'fw-el-2', type: 'text', content: 'O Grande Campeão é', x: 50, y: 250, width: 1100, height: 80, rotation: 0, z: 2, fontSize: 60, fontFamily: 'Subjectivity', color: '#4c1d95' },
        { id: 'fw-el-3', type: 'text', content: '{{name}}', x: 50, y: 330, width: 1100, height: 150, rotation: 0, z: 3, fontSize: 130, fontFamily: 'Melison', fontWeight: '700', color: '#ffffff' },
        { id: 'fw-el-4', type: 'text', content: 'Com {{stars}} ⭐', x: 50, y: 500, width: 1100, height: 80, rotation: 0, z: 4, fontSize: 50, fontFamily: 'Subjectivity', color: '#4c1d95' },
    ],
  },
   tie_announcement: {
    id: 'tie_announcement',
    name: 'Anúncio de Empate',
    canvas: { width: 1200, height: 600, background: '#e0e7ff' },
    elements: [
        { id: 'ta-el-1', type: 'text', content: '🛡️ EMPATE! 🛡️', x: 50, y: 100, width: 1100, height: 100, rotation: 0, z: 1, fontSize: 90, fontFamily: 'Melison', color: '#4338ca' },
        { id: 'ta-el-2', type: 'text', content: 'Rodada de desempate entre: {{{participantsList}}}', x: 50, y: 250, width: 1100, height: 200, rotation: 0, z: 2, fontSize: 50, fontFamily: 'Subjectivity', color: '#3730a3' },
    ],
  },
});


function StudioPageContent() {
  const [designs, setDesigns] = useState<{ [key: string]: Design }>(getInitialDesigns);
  const [selectedDesignId, setSelectedDesignId] = useState<string>('word_winner');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const design = designs[selectedDesignId];
  const selectedElement = design?.elements.find(el => el.id === selectedElementId);

  useEffect(() => {
    const designsRef = ref(database, 'designs');
    const unsubscribe = onValue(designsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Merge database data with initial designs, ensuring DB data takes precedence
            const newDesigns = getInitialDesigns();
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key) && newDesigns[key]) {
                    newDesigns[key] = { ...newDesigns[key], ...data[key] };
                } else if (Object.prototype.hasOwnProperty.call(data, key)) {
                    newDesigns[key] = data[key];
                }
            }
            setDesigns(newDesigns);
        } else {
            setDesigns(getInitialDesigns());
        }
    });
    return () => unsubscribe();
  }, []);

  const updateElement = (elementId: string, patch: Partial<EditorElement>) => {
    setDesigns(prev => {
        const newDesigns = { ...prev };
        const targetDesign = newDesigns[selectedDesignId];
        if (targetDesign) {
            targetDesign.elements = targetDesign.elements.map(el => 
                el.id === elementId ? { ...el, ...patch } : el
            );
        }
        return newDesigns;
    });
  };

  const handleSaveDesign = () => {
    if (!design) return;
    set(ref(database, `designs/${design.id}`), design)
        .then(() => toast({ title: 'Sucesso!', description: `Design "${design.name}" salvo.` }))
        .catch(err => toast({ variant: 'destructive', title: 'Erro', description: err.message }));
  };

  const addElement = (type: 'text' | 'image' | 'shape') => {
    const newZ = Math.max(0, ...(design.elements.map(e => e.z) || [0])) + 1;
    let newElement: EditorElement;
    
    switch (type) {
        case 'image':
            newElement = { id: uuidv4(), type: 'image', x: 50, y: 50, width: 300, height: 200, rotation: 0, z: newZ, src: 'https://picsum.photos/seed/image/300/200' };
            break;
        case 'shape':
            newElement = { id: uuidv4(), type: 'shape', shape: 'rect', x: 60, y: 60, width: 150, height: 100, rotation: 0, z: newZ, background: '#e2e8f0' };
            break;
        case 'text':
        default:
            newElement = { id: uuidv4(), type: 'text', content: 'Novo Texto', x: 40, y: 40, width: 250, height: 50, rotation: 0, z: newZ, fontSize: 40, color: '#000000', fontFamily: 'Subjectivity', fontWeight: '400' };
            break;
    }

    setDesigns(prev => {
        const newDesigns = { ...prev };
        newDesigns[selectedDesignId]?.elements.push(newElement);
        return newDesigns;
    });
    setSelectedElementId(newElement.id);
  };
  
  const removeElement = (elementId: string) => {
    setDesigns(prev => {
        const newDesigns = { ...prev };
        const targetDesign = newDesigns[selectedDesignId];
        if (targetDesign) {
            targetDesign.elements = targetDesign.elements.filter(el => el.id !== elementId);
        }
        return newDesigns;
    });
    setSelectedElementId(null);
  };

  return (
    <div className="flex flex-col w-full h-screen bg-muted/40 text-foreground overflow-hidden">
      <AppHeader />
      <div className="flex-grow flex min-h-0">
        {/* Left Panel */}
        <aside className="w-64 bg-background p-4 flex flex-col gap-4 border-r">
           <h3 className="text-lg font-semibold">Ferramentas</h3>
           <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => addElement('text')}><Text className="mr-2"/> Texto</Button>
              <Button variant="outline" onClick={() => addElement('image')}><ImageIcon className="mr-2"/> Imagem</Button>
              <Button variant="outline" onClick={() => addElement('shape')}><Square className="mr-2"/> Forma</Button>
           </div>
           <div className="flex-grow flex flex-col gap-2 min-h-0">
                <h3 className="text-lg font-semibold mt-4 flex items-center gap-2"><Layers /> Camadas</h3>
                <ScrollArea className="flex-grow">
                    <div className="space-y-1 pr-2">
                        {design?.elements.slice().sort((a,b) => b.z - a.z).map(el => (
                            <div 
                                key={el.id}
                                onClick={() => setSelectedElementId(el.id)}
                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${selectedElementId === el.id ? 'bg-primary/20' : 'hover:bg-muted'}`}
                            >
                                <span className="text-sm truncate">{el.type === 'text' ? el.content : el.type}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); removeElement(el.id)}}><Trash2 className="h-4 w-4 text-destructive/70"/></Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
           </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                     <Select value={selectedDesignId} onValueChange={setSelectedDesignId}>
                        <SelectTrigger className="w-56">
                            <SelectValue placeholder="Selecione um design" />
                        </SelectTrigger>
                        <SelectContent>
                            {TEMPLATE_KEYS.map(key => (
                                <SelectItem key={key} value={key}>{TEMPLATE_LABELS[key]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleSaveDesign}>Salvar Design</Button>
                </div>
                 {/* <Button variant="outline"><Download className="mr-2"/> Exportar PNG</Button> */}
            </div>
            <div className="flex-1 flex items-center justify-center bg-zinc-200 rounded-lg">
                {design && (
                    <div
                        ref={canvasRef}
                        className="relative shadow-lg"
                        style={{
                            width: design.canvas.width,
                            height: design.canvas.height,
                            background: design.canvas.background,
                            overflow: 'hidden'
                        }}
                        onMouseDown={() => setSelectedElementId(null)}
                    >
                        {design.elements.map(el => (
                            <CanvasElement 
                                key={el.id}
                                el={el}
                                selected={selectedElementId === el.id}
                                onSelect={() => setSelectedElementId(el.id)}
                                updateElement={updateElement}
                            />
                        ))}
                    </div>
                )}
            </div>
        </main>
        
        {/* Right Panel */}
        <aside className="w-72 bg-background p-4 border-l">
            <h3 className="text-lg font-semibold mb-4">Propriedades</h3>
            {selectedElement ? (
                <ScrollArea className="h-full">
                <div className="space-y-4 pr-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div><Label>X</Label><Input type="number" value={Math.round(selectedElement.x)} onChange={e => updateElement(selectedElementId!, { x: Number(e.target.value) })}/></div>
                        <div><Label>Y</Label><Input type="number" value={Math.round(selectedElement.y)} onChange={e => updateElement(selectedElementId!, { y: Number(e.target.value) })}/></div>
                    </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div><Label>Largura</Label><Input type="number" value={Math.round(selectedElement.width)} onChange={e => updateElement(selectedElementId!, { width: Number(e.target.value) })}/></div>
                        <div><Label>Altura</Label><Input type="number" value={Math.round(selectedElement.height)} onChange={e => updateElement(selectedElementId!, { height: Number(e.target.value) })}/></div>
                    </div>
                    <div><Label>Rotação</Label><Slider value={[selectedElement.rotation]} onValueChange={([v]) => updateElement(selectedElementId!, { rotation: v })} max={360} step={1} /></div>
                    
                    {selectedElement.type === 'text' && (
                        <>
                            <div><Label>Texto</Label><Input value={selectedElement.content || ''} onChange={e => updateElement(selectedElementId!, { content: e.target.value })}/></div>
                            <div><Label>Tam. Fonte</Label><Input type="number" value={selectedElement.fontSize || 16} onChange={e => updateElement(selectedElementId!, { fontSize: Number(e.target.value) })}/></div>
                            <div><Label>Cor da Fonte</Label><Input type="color" value={selectedElement.color || '#000000'} onChange={e => updateElement(selectedElementId!, { color: e.target.value })} className="h-10"/></div>
                            <div><Label>Fonte</Label>
                                <Select value={selectedElement.fontFamily || 'sans-serif'} onValueChange={v => updateElement(selectedElementId!, { fontFamily: v })}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Melison">Melison</SelectItem>
                                        <SelectItem value="Subjectivity">Subjectivity</SelectItem>
                                        <SelectItem value="sans-serif">Padrão</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Peso Fonte</Label>
                                <Select value={selectedElement.fontWeight || '400'} onValueChange={v => updateElement(selectedElementId!, { fontWeight: v as any })}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="400">Normal</SelectItem>
                                        <SelectItem value="700">Negrito</SelectItem>
                                        <SelectItem value="900">Super Negrito</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                     {selectedElement.type === 'image' && (
                        <div><Label>URL da Imagem</Label><Input value={selectedElement.src || ''} onChange={e => updateElement(selectedElementId!, { src: e.target.value })}/></div>
                    )}
                     {selectedElement.type === 'shape' && (
                        <>
                           <div><Label>Forma</Label>
                                <Select value={selectedElement.shape || 'rect'} onValueChange={v => updateElement(selectedElementId!, { shape: v as any })}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="rect">Retângulo</SelectItem>
                                        <SelectItem value="circle">Círculo</SelectItem>
                                    </SelectContent>
                                </Select>
                           </div>
                           <div><Label>Cor de Fundo</Label><Input type="color" value={selectedElement.background || '#ffffff'} onChange={e => updateElement(selectedElementId!, { background: e.target.value })} className="h-10"/></div>
                        </>
                    )}
                </div>
                </ScrollArea>
            ) : (
                <div className="text-sm text-muted-foreground mt-4">Selecione um elemento para editar.</div>
            )}
        </aside>
      </div>
    </div>
  );
}

function CanvasElement({ el, selected, onSelect, updateElement }: { el: EditorElement, selected: boolean, onSelect: () => void, updateElement: (id: string, patch: Partial<EditorElement>) => void }) {
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected || !nodeRef.current) return;
    
    let startPos = { x: 0, y: 0 };
    let startElPos = { x: el.x, y: el.y };

    const onPointerDown = (e: PointerEvent) => {
        if (e.target !== nodeRef.current && (e.target as HTMLElement).closest('.resizer')) return;
        e.stopPropagation();
        onSelect();
        startPos = { x: e.clientX, y: e.clientY };
        startElPos = { x: el.x, y: el.y };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;
        updateElement(el.id, { x: startElPos.x + dx, y: startElPos.y + dy });
    };

    const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };
    
    const currentNode = nodeRef.current;
    currentNode.addEventListener('pointerdown', onPointerDown);

    return () => {
        currentNode.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };
  }, [el.id, el.x, el.y, selected, onSelect, updateElement]);

  return (
    <motion.div
        ref={nodeRef}
        id={el.id}
        layout
        initial={{ opacity: 0.8, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
            position: 'absolute',
            left: el.x,
            top: el.y,
            width: el.width,
            height: el.height,
            transform: `rotate(${el.rotation}deg)`,
            zIndex: el.z,
            outline: selected ? '2px solid hsl(var(--primary))' : 'none',
            outlineOffset: '2px',
            cursor: selected ? 'move' : 'pointer',
        }}
        onMouseDown={(e) => { e.stopPropagation(); onSelect(); }}
        onTouchStart={(e) => { e.stopPropagation(); onSelect(); }}
    >
        {el.type === 'text' && (
            <div style={{ width: '100%', height: '100%', fontSize: el.fontSize, fontFamily: el.fontFamily, fontWeight: el.fontWeight, color: el.color, padding: '5px', boxSizing: 'border-box', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
                {el.content}
            </div>
        )}
         {el.type === 'image' && (
            <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: el.shape === 'circle' ? '50%' : '0' }}/>
        )}
         {el.type === 'shape' && (
            <div style={{ width: '100%', height: '100%', background: el.background, borderRadius: el.shape === 'circle' ? '50%' : '0' }}/>
        )}

        {selected && <Resizer el={el} updateElement={updateElement} />}
    </motion.div>
  );
}

function Resizer({ el, updateElement }: { el: EditorElement, updateElement: (id: string, patch: Partial<EditorElement>) => void }) {
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = el.width;
        const startH = el.height;

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const newWidth = Math.max(20, startW + dx);
            const newHeight = Math.max(20, startH + dy);
            updateElement(el.id, { width: newWidth, height: newHeight });
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return (
        <div
            className="resizer absolute -right-1 -bottom-1 w-4 h-4 cursor-se-resize bg-background border-2 border-primary rounded-full"
            onPointerDown={handlePointerDown}
        />
    );
}

export default function StudioPage() {
    return (
        <ProtectedRoute page="admin">
            <StudioPageContent />
        </ProtectedRoute>
    );
}
