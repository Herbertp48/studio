'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Trash2, Download } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue, remove } from 'firebase/database';
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

type Winner = {
  name: string;
  word: string;
  stars: number;
};

type AggregatedWinner = {
    name: string;
    words: { [key: string]: number };
    totalStars: number;
}

export default function WinnersPage() {
  const [winners, setWinners] = useState<AggregatedWinner[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const winnersRef = ref(database, 'winners');
    const unsubscribe = onValue(winnersRef, (snapshot) => {
      const data: Winner[] = snapshot.val() ? Object.values(snapshot.val()) : [];
      
      const aggregated: { [key: string]: AggregatedWinner } = {};

      data.forEach(winner => {
        if (!aggregated[winner.name]) {
          aggregated[winner.name] = { name: winner.name, words: {}, totalStars: 0 };
        }
        aggregated[winner.name].words[winner.word] = (aggregated[winner.name].words[winner.word] || 0) + 1;
        aggregated[winner.name].totalStars += winner.stars;
      });

      setWinners(Object.values(aggregated).sort((a, b) => b.totalStars - a.totalStars));
    });

    return () => unsubscribe();
  }, []);

  const clearWinners = () => {
    remove(ref(database, 'winners')).then(() => {
        toast({ title: "Sucesso!", description: "A lista de ganhadores foi zerada."});
    });
  };

  const exportToExcel = () => {
    const dataToExport = winners.map(w => ({
        Nome: w.name,
        Palavras: Object.entries(w.words).map(([word, count]) => `${word} (x${count})`).join(', '),
        Estrelas: w.totalStars,
    }));

    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Ganhadores');
    writeFile(workbook, 'ganhadores.xlsx');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>🏆 Ganhadores</CardTitle>
                <div className="flex gap-2">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" disabled={winners.length === 0}><Trash2 className="mr-2" /> Zerar</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Todos os registros de ganhadores serão removidos permanentemente.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={clearWinners}>Apagar Tudo</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={exportToExcel} disabled={winners.length === 0}><Download className="mr-2" /> Exportar</Button>
                </div>
            </div>
            <CardDescription>Lista de todos os vencedores das disputas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Palavras (Vitórias)</TableHead>
                  <TableHead className="text-right">Estrelas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {winners.length > 0 ? (
                  winners.map((winner) => (
                    <TableRow key={winner.name}>
                      <TableCell className="font-medium">{winner.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {Object.entries(winner.words).map(([word, count]) => (
                                <span key={word} className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs">
                                    {word} <b>(x{count})</b>
                                </span>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                           <span className="font-bold">{winner.totalStars}</span>
                           <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      Nenhum ganhador registrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
