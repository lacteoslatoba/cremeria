"use client";
import Link from "next/link";
import { ShoppingCart, User, LogOut, Bike, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

export function SideNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { items } = useCartStore();
    const { user, logout } = useAuthStore();
    const mounted = useMounted();
    const cartCount = mounted ? items.reduce((a, i) => a + i.quantity, 0) : 0;

    // /admin ya no trae su propia barra lateral de escritorio (ver
    // AdminLayout) -- los 3 portales viven en esta misma barra, así que
    // ahora también se muestra ahí.
    //
    // El rol se lee ANTES de logout() (que limpia `user`) para saber a qué
    // login volver: un admin cerrando sesión debe quedarse en el login
    // oscuro de Control Panel, no caer en el genérico de Cliente -- se
    // sentía como "la app quedó expuesta otra vez" al ver el blanco normal
    // justo después de cerrar el panel de seguridad.
    const handleLogout = async () => {
        const eraAdmin = user?.role === "ADMIN";
        await logout();
        router.push(eraAdmin ? "/login?portal=admin" : "/login");
    };

    // Los 3 portales de la app -- cada uno exige su propio login al entrar
    // (Repartidor pide cuenta DELIVERY, Admin pide cuenta ADMIN), así que no
    // se expone nada por mostrarlos siempre.
    const links = [
        { href: "/", icon: User, label: "Cliente" },
        { href: "/driver", icon: Bike, label: "Repartidor" },
        { href: "/admin", icon: ShieldCheck, label: "Control Panel" },
    ];

    return (
        <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-white/10 z-50 shadow-2xl">
            {/* Logo -- el carrito ya no es uno de los 3 portales (Cliente/
                Repartidor/Admin) de la nav de abajo, pero el cliente
                comprando no debe perder el acceso rápido mientras navega
                la tienda: se deja aquí, aparte, como icono chico. */}
            <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                    <span className="text-white font-black text-lg">C</span>
                </div>
                <div className="flex-1">
                    <p className="font-black text-white text-sm leading-tight">Cremería</p>
                    <p className="text-gray-500 text-xs">del Rancho</p>
                </div>
                <Link href="/cart" className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Carrito">
                    <ShoppingCart size={18} />
                    {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                            {cartCount > 9 ? "9+" : cartCount}
                        </span>
                    )}
                </Link>
            </div>

            {/* Nav links -- los 3 portales */}
            <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
                {links.map(({ href, icon: Icon, label }) => {
                    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                    return (
                        <Link key={label} href={href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all",
                                active
                                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}>
                            <Icon size={20} />
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
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-semibold">
                        <LogOut size={18} />
                        Cerrar sesión
                    </button>
                </div>
            )}
        </aside>
    );
}
