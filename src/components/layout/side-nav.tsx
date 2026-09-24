"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, User, LogOut, Bike, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

// Nota (23/09): 3 apps instalables independientes -- Cliente ("/", scope
// "/"), Repartidor ("/driver", scope "/driver" en driver-manifest.json) y
// Admin ("/admin", scope "/admin" en admin-manifest.json). Dentro de una ya
// instalada, tocar un link de OTRO portal sale de su scope y Chrome/Edge
// ponen su propia barra con la URL -- UI del navegador, no se puede tapar
// ni recolorear. La solucion: en modo standalone, cada app solo muestra su
// propio portal en el menu (nunca los otros 2). En una pestaña normal de
// navegador se ven los 3, para poder cambiar de portal libremente.
const SCOPES = ["/driver", "/admin"]; // "/" no entra: cualquier ruta empieza con "/"

export function SideNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { items } = useCartStore();
    const { user, logout } = useAuthStore();
    const mounted = useMounted();
    const cartCount = mounted ? items.reduce((a, i) => a + i.quantity, 0) : 0;

    const [scopeActual, setScopeActual] = useState<string | null>(null);
    useEffect(() => {
        // Se difiere un tick para no hacer setState *síncrono* dentro del
        // cuerpo del effect (regla react-hooks/set-state-in-effect).
        const id = window.setTimeout(() => {
            const standalone = window.matchMedia("(display-mode: standalone)").matches
                || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
            if (!standalone) { setScopeActual(null); return; }
            setScopeActual(SCOPES.find((s) => pathname.startsWith(s)) ?? "/");
        }, 0);
        return () => window.clearTimeout(id);
    }, [pathname]);

    // Un visitante sin cuenta (catalogo abierto por WhatsApp, sin login) no
    // debe ver el switcher de portales -- "Control Panel" ahi es exactamente
    // la exposicion publica que se corrigio en /admin, solo que en la nav.
    // Se muestra unicamente con sesion real (Cliente/Repartidor/Admin ya
    // logueados); el catalogo en si sigue siendo navegable sin cuenta.
    // (AuthGuard, el padre, ya no monta nada hasta initialized=true, asi
    // que aqui `user` nunca es un null "todavia no sabemos" -- no hay
    // parpadeo de la barra apareciendo/desapareciendo.)
    if (!user) return null;

    // /admin ya no trae su propia barra lateral de escritorio (ver
    // AdminLayout) -- los 3 portales viven en esta misma barra, así que
    // ahora también se muestra ahí.
    //
    // El rol se lee ANTES de logout() (que limpia `user`) para saber a qué
    // login volver: un admin cerrando sesión debe quedarse en el login
    // oscuro de Control Panel, no caer en el genérico de Cliente -- se
    // sentía como "la app quedó expuesta otra vez" al ver el blanco normal
    // justo después de cerrar el panel de seguridad. Mismo caso para
    // Repartidor (23/09): "no me saque a otra ventana" -- /driver ya
    // muestra su propio login en cuanto `user` queda en null.
    const handleLogout = async () => {
        const rol = user?.role;
        await logout();
        if (rol === "ADMIN") router.push("/login?portal=admin");
        else if (rol === "DELIVERY") router.push("/driver");
        else router.push("/login");
    };

    // Los 3 portales de la app -- cada uno exige su propio login al entrar
    // (Repartidor pide cuenta DELIVERY, Admin pide cuenta ADMIN), así que no
    // se expone nada por mostrarlos siempre en pestaña normal. Dentro de una
    // app instalada (scopeActual != null), solo se queda el link del scope
    // en el que ya estamos.
    const links = [
        { href: "/", icon: User, label: "Cliente" },
        { href: "/driver", icon: Bike, label: "Repartidor" },
        { href: "/admin", icon: ShieldCheck, label: "Control Panel" },
    ].filter((link) => scopeActual === null || link.href === scopeActual);

    return (
        <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-white/10 z-50 shadow-2xl">
            {/* Logo -- el carrito ya no es uno de los 3 portales (Cliente/
                Repartidor/Admin) de la nav de abajo, pero el cliente
                comprando no debe perder el acceso rápido mientras navega
                la tienda: se deja aquí, aparte, como icono chico. Dentro de
                Repartidor/Admin instalados no tiene sentido (no son scope
                de Cliente), asi que tambien se filtra por scopeActual. */}
            <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                    <span className="text-white font-black text-lg">C</span>
                </div>
                <div className="flex-1">
                    <p className="font-black text-white text-sm leading-tight">Cremería</p>
                    <p className="text-gray-500 text-xs">del Rancho</p>
                </div>
                {(scopeActual === null || scopeActual === "/") && (
                    <Link href="/cart" className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Carrito">
                        <ShoppingCart size={18} />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                                {cartCount > 9 ? "9+" : cartCount}
                            </span>
                        )}
                    </Link>
                )}
            </div>

            {/* Nav links -- portales visibles segun el contexto (ver arriba) */}
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
