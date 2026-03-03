"use client"
import Link from 'next/link';
import { Home, ShoppingCart, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import styles from './bottom-nav.module.css';
import { useCartStore } from '@/lib/cart-store';
import { useState, useEffect } from 'react';

export function BottomNav() {
    const pathname = usePathname();
    const { items } = useCartStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const cartCount = mounted ? items.reduce((acc, item) => acc + item.quantity, 0) : 0;

    return (
        <nav className={cn(styles.nav, "bottom-nav-mobile fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] z-50 bg-[#1e1e1e]/90 backdrop-blur-md border-t border-white/10")}>
            <div className="flex justify-around items-center h-16 px-4 w-full">
                <NavItem href="/" icon={Home} label="Inicio" active={pathname === '/'} />
                <NavItem href="/cart" icon={ShoppingCart} label="Carrito" active={pathname === '/cart'} badge={cartCount} />
                <NavItem href="/admin" icon={User} label="Admin" active={pathname === '/admin'} />
            </div>
        </nav>
    );
}

function NavItem({ href, icon: Icon, label, active, badge }: { href: string; icon: any; label: string; active: boolean; badge?: number }) {
    return (
        <Link href={href} className={cn(styles.navItem, "relative flex flex-col items-center justify-center w-full h-full space-y-1", active ? "text-[#ee2b34]" : "text-gray-400 hover:text-gray-200")}>
            <div className="relative">
                <Icon size={24} className={cn(active && "drop-shadow-[0_0_8px_rgba(238,43,52,0.8)]")} />
                {badge && badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 bg-[#ee2b34] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                        {badge > 9 ? '9+' : badge}
                    </span>
                ) : null}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
        </Link>
    );
}
