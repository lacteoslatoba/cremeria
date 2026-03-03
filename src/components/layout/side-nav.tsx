"use client";
import Link from "next/link";
import { Home, ShoppingCart, User, LogOut, Package } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function SideNav() {
    const pathname = usePathname();
    const { items } = useCartStore();
    const { user, logout } = useAuthStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);
    const cartCount = mounted ? items.reduce((a, i) => a + i.quantity, 0) : 0;

    const links = [
        { href: "/", icon: Home, label: "Inicio" },
        { href: "/cart", icon: ShoppingCart, label: "Carrito", badge: cartCount },
        ...(user?.role === "ADMIN" ? [{ href: "/admin", icon: Package, label: "Admin", badge: 0 }] : []),
        { href: "/admin", icon: User, label: user ? "Mi cuenta" : "Entrar", badge: 0 },
    ];

    return (
        <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-white/10 z-50 shadow-2xl">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                    <span className="text-white font-black text-lg">C</span>
                </div>
                <div>
                    <p className="font-black text-white text-sm leading-tight">Cremería</p>
                    <p className="text-gray-500 text-xs">del Rancho</p>
                </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
                {links.map(({ href, icon: Icon, label, badge }) => {
                    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                    return (
                        <Link key={label} href={href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all",
                                active
                                    ? "bg-primary/15 text-primary border border-primary/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}>
                            <div className="relative">
                                <Icon size={20} />
                                {(badge ?? 0) > 0 && (
                                    <span className="absolute -top-1.5 -right-2 bg-primary text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                                        {(badge ?? 0) > 9 ? "9+" : badge}
                                    </span>
                                )}
                            </div>
                            <span>{label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* User / logout */}
            {user && (
                <div className="px-3 pb-6 border-t border-white/10 pt-4">
                    <div className="px-4 py-2 mb-2">
                        <p className="text-xs text-gray-500">Conectado como</p>
                        <p className="text-sm font-bold text-white truncate">{user.name || user.email}</p>
                    </div>
                    <button onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-semibold">
                        <LogOut size={18} />
                        Cerrar sesión
                    </button>
                </div>
            )}
        </aside>
    );
}
