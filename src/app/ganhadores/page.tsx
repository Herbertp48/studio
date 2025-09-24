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
        <Card className="bg-[#fffbe6] border-none shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle className="text-[#fd8c00] font-melison text-4xl">🏆 Ganhadores</CardTitle>
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
            <CardDescription className="text-accent-foreground/80">Lista de todos os vencedores das disputas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-b-4 border-accent/80 hover:bg-accent/20">
                  <TableHead className="text-accent-foreground font-bold text-lg font-melison">Nome</TableHead>
                  <TableHead className="text-accent-foreground font-bold text-lg font-melison">Palavras (Vitórias)</TableHead>
                  <TableHead className="text-right text-accent-foreground font-bold text-lg font-melison">Estrelas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {winners.length > 0 ? (
                  winners.map((winner, index) => (
                    <TableRow key={winner.name} className={index % 2 === 0 ? 'bg-[#fff6d6]' : 'bg-[#fffbe6]'}>
                      <TableCell className="font-bold text-white bg-accent-foreground rounded-md text-base">
                        {winner.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(winner.words).map(([word, count]) => (
                                <span key={word} className="bg-accent text-accent-foreground rounded-md px-3 py-1 text-sm font-subjectivity font-bold">
                                    {word} <b className="text-white/80">(x{count})</b>
                                </span>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                           <span className="font-bold text-2xl text-yellow-500">{winner.totalStars}</span>
                           <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
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
