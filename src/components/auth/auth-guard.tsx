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

        // Rutas que SÍ exigen sesión: el flujo de compra. Desde el 18/09 no hay
        // compra de invitado, así que carrito→pago→seguimiento necesitan cuenta.
        //
        // La tienda (/) y las páginas públicas NO están en esta lista a propósito: antes
        // se bloqueaba CUALQUIER ruta de cliente, así que un visitante sin cuenta no
        // podía ni ver el catálogo -- el link que se comparte por WhatsApp caía en el
        // login, y en escritorio el enlace "Cliente" del menú rebotaba al login en un
        // callejón sin salida. Para comprar sí se pide cuenta; para mirar, no.
        const RUTAS_CON_SESION = ["/cart", "/checkout", "/mis-pedidos", "/tracking", "/direccion"];
        const pideSesion = RUTAS_CON_SESION.some((ruta) => pathname.startsWith(ruta));

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
