import { SpellCheck, Home, List, Dices, Trophy, LogOut, Users, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export function AppHeader() {
  const pathname = usePathname();
  const { user, userPermissions, logout } = useAuth();

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

  return (
    <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <div className='flex items-center gap-2'>
              <SpellCheck className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Spelling Bee
              </h1>
            </div>
             {user && (
              <div className='flex items-center gap-2 text-sm text-muted-foreground border-l pl-4'>
                <User className='h-4 w-4'/>
                <span>{user.email}</span>
              </div>
            )}
          </div>
          <nav className="flex items-center gap-2">
            {user && availableNavItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className={cn(
                  'text-muted-foreground',
                  pathname === item.href && 'text-primary bg-muted'
                )}
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
             {user && (
              <Button variant="ghost" onClick={logout} className="text-muted-foreground">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
