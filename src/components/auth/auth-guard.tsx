"use client"
import { useAuthStore } from "@/lib/auth-store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        // Si no hay usuario logueado, redigir al Login salvo que ya estemos en Login o rutas públicas como admin (segun logica, admin tiene su propio pass, pero asumo q admin es publico o separado, si quieres proteger Admin tmb se puede)
        const isLogin = pathname === "/login";

        // No bloquear a usuarios entrando al /admin
        // Aunque lo ideal es que admin tenga otra forma de logearse, permitimos acceso
        const isAdmin = pathname.startsWith("/admin");

        if (!user && !isLogin && !isAdmin) {
            router.push("/login");
        }
    }, [user, pathname, router, mounted]);

    if (!mounted) return null;

    return <>{children}</>;
}
