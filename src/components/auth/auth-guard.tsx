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

        const isLogin = pathname === "/login";
        const isForgotPassword = pathname === "/forgot-password";
        const isCheckout = pathname.startsWith("/checkout"); // incluye /checkout/stripe-return
        const isTracking = pathname.startsWith("/tracking");
        const isDireccion = pathname.startsWith("/direccion");
        const isAdmin = pathname.startsWith("/admin");
        const isDriver = pathname.startsWith("/driver");

        // Un ADMIN solo ve el panel de administración: cualquier otra ruta lo manda
        // directamente a /admin (no entra a la tienda).
        if (user?.role === "ADMIN") {
            if (!isAdmin) {
                router.push("/admin");
            }
            return;
        }

        if (!user && !isLogin && !isAdmin && !isDriver && !isForgotPassword && !isCheckout && !isTracking && !isDireccion) {
            router.push("/login");
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
