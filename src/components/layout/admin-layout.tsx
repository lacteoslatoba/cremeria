"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard (Inventario)" },
    { href: "/admin/orders", icon: ShoppingCart, label: "Pedidos" },
    { href: "/admin/customers", icon: Users, label: "Clientes" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans">

            {/* Sidebar */}
            <aside className="w-64 flex flex-col justify-between p-6 bg-white border-r border-gray-200">
                <div>
                    <div className="mb-10 pl-2">
                        <h1 className="text-2xl font-black tracking-tight text-gray-900">
                            Cremeria <span className="text-primary italic">Admin</span>
                        </h1>
                    </div>

                    <nav className="space-y-2">
                        {NAV_ITEMS.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-medium",
                                    pathname === item.href
                                        ? "bg-primary text-white shadow-md shadow-primary/30"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <item.icon size={20} />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div>
                    <Link
                        href="/"
                        className="flex items-center gap-4 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors font-medium"
                    >
                        <LogOut size={20} />
                        Salir
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {children}
            </main>
        </div>
    );
}
