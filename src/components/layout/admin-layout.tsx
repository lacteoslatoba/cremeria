"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard (Inventario)" },
    { href: "/admin/orders", icon: ShoppingCart, label: "Pedidos" },
    { href: "/admin/sales", icon: Package, label: "Historial de Ventas" },
    { href: "/admin/customers", icon: Users, label: "Clientes" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans">

            {/* Topbar (Mobile) / Sidebar (Desktop) */}
            <aside className="w-full md:w-64 flex flex-row md:flex-col justify-between items-center md:items-stretch p-4 md:p-6 bg-white border-b md:border-b-0 md:border-r border-gray-200 shrink-0 z-10 shadow-sm md:shadow-none min-h-[70px]">
                <div className="flex flex-row md:flex-col items-center md:items-stretch w-full overflow-x-auto no-scrollbar gap-4 md:gap-0">
                    <div className="md:mb-10 pl-2 shrink-0">
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-900">
                            Cremeria <span className="text-primary italic">Admin</span>
                        </h1>
                    </div>

                    <nav className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2 shrink-0">
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
                                <item.icon size={18} className="md:w-5 md:h-5" />
                                <span className={cn(pathname !== item.href && "hidden md:inline")}>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="shrink-0 ml-4 md:ml-0 md:mt-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-2 md:py-3 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors font-medium text-sm md:text-base"
                    >
                        <LogOut size={18} className="md:w-5 md:h-5" />
                        <span className="hidden md:inline">Salir</span>
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
