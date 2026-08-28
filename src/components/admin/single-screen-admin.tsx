"use client";

import { useState } from "react";
import { LayoutDashboard, ShoppingCart, History, Users, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    AdminInventory,
    AdminOrders,
    AdminCustomers,
    AdminDrivers,
    type AdminTab,
} from "@/components/admin/admin-sections";
import { SalesHistory } from "@/components/admin/sales-history";

const TABS: { key: AdminTab; label: string; icon: any; title: string; subtitle: string }[] = [
    { key: "inventory", label: "Inventario", icon: LayoutDashboard, title: "Inventario", subtitle: "Gestiona los productos disponibles en tienda." },
    { key: "orders", label: "Pedidos", icon: ShoppingCart, title: "Pedidos", subtitle: "Revisa y actualiza el estado de los pedidos." },
    { key: "sales", label: "Ventas", icon: History, title: "Historial de Ventas", subtitle: "Registro de ventas finalizadas y pedidos cancelados." },
    { key: "customers", label: "Clientes", icon: Users, title: "Directorio de Clientes", subtitle: "Visualiza los clientes que se han registrado en tu tienda." },
    { key: "drivers", label: "Repartidores", icon: Bike, title: "Repartidores", subtitle: "Da de alta a tus repartidores y revisa quién está en línea." },
];

type SingleScreenAdminProps = {
    products: any[];
    orders: any[];
    salesOrders: any[];
    customers: any[];
    drivers: any[];
};

export function SingleScreenAdmin({ products, orders, salesOrders, customers, drivers }: SingleScreenAdminProps) {
    const [tab, setTab] = useState<AdminTab>("inventory");
    const active = TABS.find((t) => t.key === tab)!;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
            {/* Cabecera con título de la sección activa */}
            <div className="mb-5">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{active.title}</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">{active.subtitle}</p>
            </div>

            {/* Barra de pestañas */}
            <div className="flex items-center gap-1 sm:gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            "flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all",
                            tab === t.key
                                ? "bg-primary text-white shadow-md shadow-primary/30"
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        )}
                    >
                        <t.icon size={16} />
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Contenido de la pestaña activa */}
            <div className="flex-1 overflow-y-auto w-full">
                {tab === "inventory" && <AdminInventory products={products} />}
                {tab === "orders" && <AdminOrders orders={orders} />}
                {tab === "sales" && <SalesHistory orders={salesOrders} />}
                {tab === "customers" && <AdminCustomers users={customers} />}
                {tab === "drivers" && <AdminDrivers drivers={drivers} />}
            </div>
        </div>
    );
}
