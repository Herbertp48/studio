'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus } from 'lucide-react';

interface AddParticipantFormProps {
  onAddParticipant: (name: string, group: 'A' | 'B') => void;
}

export function AddParticipantForm({ onAddParticipant }: AddParticipantFormProps) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<'A' | 'B'>('A');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAddParticipant(name.trim(), group);
      setName('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus /> Adicionar Participante</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="participant-name">Nome</Label>
            <Input
              id="participant-name"
              placeholder="Nome do participante"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Grupo</Label>
            <RadioGroup defaultValue="A" value={group} onValueChange={(value: 'A' | 'B') => setGroup(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="A" id="group-a" />
                <Label htmlFor="group-a">Grupo A</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="B" id="group-b" />
                <Label htmlFor="group-b">Grupo B</Label>
              </div>
            </RadioGroup>
          </div>
          <Button type="submit" className="w-full">Adicionar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
