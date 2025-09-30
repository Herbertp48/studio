import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { AppFooter } from '@/components/app/footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Spelling Bee',
  description: 'Gerencie e conduza uma disputa de soletração.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={cn('font-sans antialiased', inter.variable)}>
        <div className="flex flex-col min-h-screen">
          <AuthProvider>
            <main className="flex-grow">{children}</main>
            <AppFooter />
          </AuthProvider>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
