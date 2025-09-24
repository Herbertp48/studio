import type { Participant } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Trash2, Star } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface ParticipantGroupProps {
  title: string;
  participants: Participant[];
  onRemove: (id: string) => void;
}

export function ParticipantGroup({ title, participants, onRemove }: ParticipantGroupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{participants.length} participante(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          <ul className="space-y-2">
            {participants.length > 0 ? (
              participants.map(p => (
                <li
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <span className="font-medium">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum participante adicionado.
              </p>
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
