"use client"
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { logout } = useAuthStore();

    // Este botón solo existe en el panel de admin -- siempre vuelve al
    // login oscuro de Control Panel (ver el mismo criterio en SideNav).
    const handleLogout = async () => {
        await logout();
        router.push("/login?portal=admin");
    };

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans">

            {/* Topbar -- solo en celular. En escritorio la navegación y el
                "Cerrar sesión" ya los da el SideNav de los 3 portales (antes
                /admin traía su propia barra aparte y salían dos sidebars). */}
            <aside className="w-full md:hidden flex justify-between items-center p-4 bg-white border-b border-gray-200 shrink-0 z-10 shadow-sm">
                <h1 className="text-xl font-black tracking-tight text-gray-900">
                    Cremeria <span className="text-primary italic">Admin</span>
                </h1>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Salir"
                >
                    <LogOut size={20} />
                </button>
            </aside>

            {/* Main Content -- con padding propio y centrado (max-width) para
                que en monitores muy anchos no se vea todo pegado al sidebar
                y estirado hasta el borde derecho sin ningún respiro. */}
            <main className="flex-1 flex flex-col h-[calc(100vh-70px)] md:h-screen overflow-hidden p-4 md:p-8 md:max-w-[1600px] md:mx-auto md:w-full">
                {children}
            </main>
        </div>
    );
}

