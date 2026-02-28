"use client"
import { useAuthStore } from "@/lib/auth-store";
import { LogOut, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function HomeHeader() {
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLogout = () => {
        logout();
        router.push("/login"); // Push to login screen after clearing session
    };

    if (!mounted) return null;

    const firstName = user?.name ? user.name.split(" ")[0] : "Invitado";

    return (
        <header className="pt-10 px-4 flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-black text-foreground tracking-tight">
                    Hola, <span className="text-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.4)]">{firstName}</span> 👋
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">¿Llevamos tu despensa hoy?</p>
            </div>
            {/* Cerrar Sesión / Login Button */}
            <button
                onClick={handleLogout}
                className="flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 shadow-sm hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors text-gray-500"
                title={user?.role === "GUEST" ? "Iniciar Sesión" : "Cerrar Sesión"}
            >
                {user?.role === "GUEST" ? <LogIn size={20} /> : <LogOut size={20} />}
            </button>
        </header>
    );
}
