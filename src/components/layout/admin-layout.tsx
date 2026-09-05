"use client"
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { logout } = useAuthStore();

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans">

            {/* Topbar (Mobile) / Sidebar (Desktop) */}
            <aside className="w-full md:w-64 flex flex-col justify-between p-4 md:p-6 bg-white border-b md:border-b-0 md:border-r border-gray-200 shrink-0 z-10 shadow-sm md:shadow-none gap-3 md:gap-0">

                {/* Title and Logout (Mobile) */}
                <div className="flex justify-between items-center w-full md:hidden">
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
                </div>

                {/* Desktop Title */}
                <div className="hidden md:block mb-10 pl-2">
                    <h2 className="text-2xl font-black tracking-tight text-gray-900">
                        Cremeria <span className="text-primary italic">Admin</span>
                    </h2>
                    <p className="text-sm text-gray-400 font-medium mt-2">Panel de administración</p>
                </div>

                {/* Desktop Logout */}
                <div className="hidden md:block mt-4">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors font-medium text-base"
                    >
                        <LogOut size={20} />
                        <span>Salir</span>
                    </button>
                </div>
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

