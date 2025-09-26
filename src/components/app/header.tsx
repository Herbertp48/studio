import { Bug, Home, List, Dices, Trophy, LogOut, Users, User, Menu } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useState } from 'react';

export function AppHeader() {
  const pathname = usePathname();
  const { user, userPermissions, logout } = useAuth();
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Início', icon: Home, requiredPermission: 'inicio' },
    { href: '/disputa', label: 'Disputa', icon: List, requiredPermission: 'disputa' },
    { href: '/sorteio', label: 'Sorteio', icon: Dices, requiredPermission: 'sorteio' },
    { href: '/ganhadores', label: 'Ganhadores', icon: Trophy, requiredPermission: 'ganhadores' },
    { href: '/usuarios', label: 'Usuários', icon: Users, requiredPermission: 'admin' },
  ];

  const availableNavItems = navItems.filter(item => {
    if (!user) return false;
    if (userPermissions?.role === 'admin') return true;
    if (item.requiredPermission === 'admin') return false;
    return userPermissions?.permissions?.[item.requiredPermission as keyof typeof userPermissions.permissions];
  })

  const NavLink = ({ item, isMobile = false }: { item: typeof navItems[0], isMobile?: boolean }) => (
    <Button
      key={item.href}
      variant="ghost"
      asChild
      className={cn(
        'text-muted-foreground justify-start',
        pathname === item.href && 'text-primary bg-muted',
        isMobile && 'text-lg w-full'
      )}
      onClick={() => isMobile && setIsSheetOpen(false)}
    >
      <Link href={item.href}>
        <item.icon className="mr-2 h-5 w-5" />
        {item.label}
      </Link>
    </Button>
  );

  return (
    <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className='flex items-center gap-2'>
              <Bug className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Spelling Bee
              </h1>
            </Link>
            {user && (
              <div className='hidden md:flex items-center gap-2 text-sm text-muted-foreground border-l pl-4'>
                <User className='h-4 w-4'/>
                <span>{user.email}</span>
              </div>
            )}
          </div>

          {isMobile ? (
             <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu />
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 py-8">
                        {user && availableNavItems.map((item) => (
                           <NavLink key={item.href} item={item} isMobile={true}/>
                        ))}
                         {user && (
                            <>
                             <div className='flex items-center gap-2 text-sm text-muted-foreground border-t pt-4 mt-4'>
                                <User className='h-4 w-4'/>
                                <span>{user.email}</span>
                            </div>
                            <Button variant="ghost" onClick={logout} className="text-muted-foreground justify-start text-lg w-full">
                                <LogOut className="mr-2 h-5 w-5" />
                                Sair
                            </Button>
                            </>
                        )}
                    </div>
                </SheetContent>
             </Sheet>
          ) : (
            <nav className="flex items-center gap-1">
                {user && availableNavItems.map((item) => <NavLink key={item.href} item={item} />)}
                {user && (
                <Button variant="ghost" onClick={logout} className="text-muted-foreground">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                </Button>
                )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
