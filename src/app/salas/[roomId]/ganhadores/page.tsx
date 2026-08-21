'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Trash2, Download, Trophy, Projector } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue, remove, set } from 'firebase/database';
import { utils, writeFile } from 'xlsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import type { AggregatedWinner } from '@/app/ganhadores/page';

type Winner = {
  name: string;
  word: string;
  stars: number;
};

function RoomWinnersPageContent() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [winners, setWinners] = useState<AggregatedWinner[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const winnersRef = ref(database, `rooms/${roomId}/winners`);
    return onValue(winnersRef, snapshot => {
      const data: Winner[] = snapshot.val() ? Object.values(snapshot.val()) : [];
      const aggregated: { [key: string]: AggregatedWinner } = {};

      data.forEach(winner => {
        if (!aggregated[winner.name]) {
          aggregated[winner.name] = { name: winner.name, words: {}, totalStars: 0 };
        }
        if (winner.stars === 0) {
          aggregated[winner.name].words[winner.word] = (aggregated[winner.name].words[winner.word] || 0) + 1;
        }
        aggregated[winner.name].totalStars += winner.stars;
      });

      setWinners(Object.values(aggregated).sort((a, b) => b.totalStars - a.totalStars));
    });
  }, [roomId]);

  const clearWinners = () => {
    remove(ref(database, `rooms/${roomId}/winners`)).then(() => {
      toast({ title: 'Sucesso!', description: 'A lista de ganhadores da sala foi zerada.' });
    });
  };

  const exportToExcel = () => {
    const dataToExport = winners.map(winner => ({
      Nome: winner.name,
      Palavras: Object.entries(winner.words).map(([word, count]) => `${word} (x${count})`).join(', '),
      Estrelas: winner.totalStars,
    }));
    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Ganhadores');
    writeFile(workbook, `ganhadores-${roomId}.xlsx`);
  };

  const projectWinners = () => {
    set(ref(database, `rooms/${roomId}/dispute/state`), { type: 'RESET' }).then(() => {
      setTimeout(() => {
        set(ref(database, `rooms/${roomId}/dispute/state`), { type: 'SHOW_WINNERS', payload: { winners } });
        toast({ title: 'Projetando Ganhadores!', description: 'A classificação da sala está sendo exibida.' });
      }, 200);
    });
  };

  return (
    <div className="flex flex-col w-full bg-background text-foreground">
      <AppHeader />
      <div className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-[#fffbe6] border-amber-300 border-2 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-accent p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <CardTitle className="text-accent-foreground font-melison text-2xl sm:text-3xl lg:text-4xl flex items-center gap-3">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10" /> Ganhadores da Sala
              </CardTitle>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={winners.length === 0}><Trash2 className="mr-2" /> Zerar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>Todos os registros de ganhadores desta sala serão removidos.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={clearWinners}>Apagar Tudo</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button onClick={exportToExcel} disabled={winners.length === 0}><Download className="mr-2" /> Exportar</Button>
                <Button onClick={projectWinners} disabled={winners.length === 0}><Projector className="mr-2" /> Projetar</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-1/3 text-center text-accent-foreground font-bold text-lg py-3">Nome</TableHead>
                  <TableHead className="w-1/3 text-center text-accent-foreground font-bold text-lg py-3">Palavras</TableHead>
                  <TableHead className="w-1/3 text-center text-accent-foreground font-bold text-lg py-3">Estrelas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {winners.length > 0 ? winners.map(winner => (
                  <TableRow key={winner.name} className="border-t-2 border-amber-300">
                    <TableCell className="font-bold text-accent-foreground text-center text-base p-4">{winner.name}</TableCell>
                    <TableCell className="text-center p-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {Object.entries(winner.words).map(([word, count]) => (
                          <span key={word} className="text-accent-foreground text-base font-bold">{word} <b className="text-red-600/80">x{count}</b></span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center p-4">
                      <div className="flex items-center justify-center gap-1">
                        {Array.from({ length: winner.totalStars }).map((_, index) => <Star key={index} className="w-6 h-6 text-yellow-400 fill-yellow-400" />)}
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Nenhum ganhador registrado nesta sala.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RoomWinnersPage() {
  return (
    <ProtectedRoute page="ganhadores">
      <RoomWinnersPageContent />
    </ProtectedRoute>
  );
}
