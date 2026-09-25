"use client";
import Link from "next/link";
import { ShoppingCart, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { useMounted } from "@/lib/use-mounted";

// Nota (24/09): ya no hay switcher de portales aqui -- Cliente, Repartidor
// y Admin son 3 apps instalables independientes (pensadas para instalarse
// en el celular, cada una por su cuenta), asi que cambiar de una a otra
// desde un menu compartido ya no tiene sentido (y ya no hace falta
// detectar "standalone": sin links que ocultar por eso, con mirar la ruta
// actual alcanza). El logo+carrito son solo de Cliente comprando desde
// escritorio sin tener la app instalada. El logout se queda siempre
// visible en las 3: en /admin es el UNICO boton de cerrar sesion en
// escritorio (el topbar propio de AdminLayout es md:hidden, solo celular).

export function SideNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { items } = useCartStore();
    const { user, logout } = useAuthStore();
    const mounted = useMounted();
    const cartCount = mounted ? items.reduce((a, i) => a + i.quantity, 0) : 0;

    // Un visitante sin cuenta (catalogo abierto por WhatsApp, sin login) no
    // debe ver esta barra -- se muestra unicamente con sesion real; el
    // catalogo en si sigue siendo navegable sin cuenta.
    // (AuthGuard, el padre, ya no monta nada hasta initialized=true, asi
    // que aqui `user` nunca es un null "todavia no sabemos" -- no hay
    // parpadeo de la barra apareciendo/desapareciendo.)
    if (!user) return null;

    // La landing publica ("/") es una pagina de marketing sin chrome de la
    // app -- si el navegador ya tiene sesion abierta de OTRO portal (p. ej.
    // un repartidor que tambien visita cremeriadelrancho.com), la barra no
    // debe aparecer encima del diseño de la landing (25/09, reportado por
    // Mike con captura: se veia el sidebar de Pedro Ramos sobre la landing).
    if (pathname === "/") return null;

    // El rol se lee ANTES de logout() (que limpia `user`) para saber a qué
    // login volver: un admin cerrando sesión debe quedarse en el login
    // oscuro de Control Panel, no caer en el genérico de Cliente -- se
    // sentía como "la app quedó expuesta otra vez" al ver el blanco normal
    // justo después de cerrar el panel de seguridad. Mismo caso para
    // Repartidor: /driver ya muestra su propio login en cuanto `user`
    // queda en null.
    const handleLogout = async () => {
        const rol = user?.role;
        await logout();
        if (rol === "ADMIN") router.push("/login?portal=admin");
        else if (rol === "DELIVERY") router.push("/driver");
        else router.push("/login");
    };

    const esCliente = !pathname.startsWith("/admin") && !pathname.startsWith("/driver");

    return (
        <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-white/10 z-50 shadow-2xl">
            {esCliente && (
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
            )}

            <div className="flex-1" />

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
        </aside>
    );
}
