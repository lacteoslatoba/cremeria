"use client"
import { useAuthStore } from "@/lib/auth-store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, initialized, init } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Restaura la sesión real desde la cookie HttpOnly (server-side) al cargar.
        if (!initialized) {
            init();
        }
    }, [initialized, init]);

    useEffect(() => {
        if (!initialized) return;

        // /main sirve el mismo contenido de /login por dentro (rewrite en
        // next.config.ts) pero la URL visible se queda en /main -- sin este
        // OR, un invitado entrando por /main se manda a sí mismo de vuelta
        // a /login en un loop.
        const isLogin = pathname === "/login" || pathname === "/main";
        const isForgotPassword = pathname === "/forgot-password";
        const isAdmin = pathname.startsWith("/admin");
        const isDriver = pathname.startsWith("/driver");

        // Antes un ADMIN quedaba encerrado en /admin -- cualquier otra ruta lo
        // mandaba de vuelta ahí mismo. Con los 3 portales en un solo menú
        // (SideNav: Cliente/Repartidor/Admin) eso se sentía roto: le dabas
        // clic a "Repartidor" y "no pasaba nada" (el guard te regresaba a
        // Admin sin avisar). Ya no se fuerza: un admin puede navegar a
        // cualquier portal como cualquier otro usuario -- cada pantalla ya
        // filtra por su propio rol (p. ej. /driver exige cuenta DELIVERY).
        if (user?.role === "ADMIN" && isAdmin) {
            return;
        }

        // Rutas que SÍ exigen sesión.
        //
        // "/" volvió a pedir cuenta (23/09, instruccion directa de Mike: "esa
        // pantalla [login] es la que debe estar en cremeriadelrancho.com").
        // Esto revierte la decision del 18/09 (navegar el catalogo sin cuenta,
        // pensada para links de WhatsApp) -- si se vuelve a compartir el
        // catalogo sin cuenta, seria necesario replantear esto de nuevo.
        // "/" es exacta a proposito: con startsWith("/") haria match con
        // CUALQUIER ruta (todas empiezan con "/"), incluyendo /terminos o
        // /aviso-privacidad que deben seguir siendo publicas.
        const RUTAS_CON_SESION = ["/cart", "/checkout", "/mis-pedidos", "/tracking", "/direccion"];
        const pideSesion = pathname === "/" || RUTAS_CON_SESION.some((ruta) => pathname.startsWith(ruta));

        if (!user && !isLogin && !isAdmin && !isDriver && !isForgotPassword && pideSesion) {
            router.push("/login?portal=cliente");
        }
    }, [user, pathname, router, initialized]);

    // Mientras se resuelve la sesión (un solo round-trip a /api/auth/me,
    // normalmente breve) se mostraba una pantalla en blanco. No es un bug de
    // datos -- nunca se llegó a mostrar "Invitado" para luego corregirse al
    // nombre real, porque nada de {children} se monta hasta initialized=true
    // -- pero el blanco seco se siente peor que un spinner con marca, mismo
    // que ya usa loading.tsx para las transiciones entre rutas.
    if (!initialized) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-background">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return <>{children}</>;
}
