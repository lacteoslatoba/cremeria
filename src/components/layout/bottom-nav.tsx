"use client"
import Link from 'next/link';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import styles from './bottom-nav.module.css';

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className={cn(styles.nav, "fixed bottom-0 left-0 right-0 z-50 bg-[#1e1e1e]/90 backdrop-blur-md border-t border-white/10")}>
            <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
                <NavItem href="/" icon={Home} label="Inicio" active={pathname === '/'} />
                <NavItem href="/search" icon={Search} label="Buscar" active={pathname === '/search'} />
                <NavItem href="/cart" icon={ShoppingBag} label="Ordenes" active={pathname === '/cart'} />
                <NavItem href="/profile" icon={User} label="Perfil" active={pathname === '/profile'} />
            </div>
        </nav>
    );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
    return (
        <Link href={href} className={cn(styles.navItem, "flex flex-col items-center justify-center w-full h-full space-y-1", active ? "text-[#ee2b34]" : "text-gray-400 hover:text-gray-200")}>
            <Icon size={24} className={cn(active && "drop-shadow-[0_0_8px_rgba(238,43,52,0.8)]")} />
            <span className="text-[10px] font-medium">{label}</span>
        </Link>
    );
}
