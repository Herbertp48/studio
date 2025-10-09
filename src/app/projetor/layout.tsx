import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projetor - Spelling Bee',
  description: 'Tela de projeção para a disputa de soletração.',
};

export default function ProjectorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">{children}</main>
    </div>
  );
}
