"use client"
import { useAuthStore } from "@/lib/auth-store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

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

        if (!user && !isLogin && !isAdmin && !isDriver && !isForgotPassword && !isCheckout && !isTracking) {
            router.push("/login");
        }
    }, [user, pathname, router, initialized]);

    if (!initialized) return null;

    return <>{children}</>;
}
