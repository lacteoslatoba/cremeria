"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/admin", icon: LayoutDashboard, label: "Inventario" },
    { href: "/admin/orders", icon: ShoppingCart, label: "Pedidos" },
    { href: "/admin/sales", icon: Package, label: "Historial de Ventas" },
    { href: "/admin/customers", icon: Users, label: "Clientes" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans">

            {/* Topbar (Mobile) / Sidebar (Desktop) */}
            <aside className="w-full md:w-64 flex flex-col justify-between p-4 md:p-6 bg-white border-b md:border-b-0 md:border-r border-gray-200 shrink-0 z-10 shadow-sm md:shadow-none gap-3 md:gap-0">

                {/* Title and Logout (Mobile) */}
                <div className="flex justify-between items-center w-full md:hidden">
                    <h1 className="text-xl font-black tracking-tight text-gray-900">
                        Cremeria <span className="text-primary italic">Admin</span>
                    </h1>
                    <Link
                        href="/"
                        className="flex items-center gap-2 p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Salir"
                    >
                        <LogOut size={20} />
                    </Link>
                </div>

                {/* Desktop Title */}
                <div className="hidden md:block mb-10 pl-2">
                    <h2 className="text-2xl font-black tracking-tight text-gray-900">
                        Cremeria <span className="text-primary italic">Admin</span>
                    </h2>
                </div>

                <nav className="flex flex-row md:flex-col items-center md:items-stretch overflow-x-auto no-scrollbar space-x-2 md:space-x-0 md:space-y-2 w-full pb-1 md:pb-0">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-2 md:gap-4 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all font-medium text-sm md:text-base whitespace-nowrap",
                                pathname === item.href
                                    ? "bg-primary text-white shadow-md shadow-primary/30"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <item.icon size={18} className="md:w-5 md:h-5 shrink-0" />
                            <span className={cn(pathname !== item.href && "block", "md:inline")}>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Desktop Logout */}
                <div className="hidden md:block mt-4">
                    <Link
                        href="/"
                        className="flex items-center gap-4 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors font-medium text-base"
                    >
                        <LogOut size={20} />
                        <span>Salir</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-[calc(100vh-70px)] md:h-screen overflow-hidden">
                {children}
            </main>
        </div>
    );
}
