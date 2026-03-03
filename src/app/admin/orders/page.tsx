"use client"

import { useState, useEffect } from "react";
import { ExternalLink, Search, Loader2 } from "lucide-react";
import { OrderStatusUpdate } from "@/components/admin/order-status-update";
import { OrderDeleteButton } from "@/components/admin/order-delete-button";

const getStatusColor = (status: string) => {
    switch (status) {
        case "PENDING": return "bg-orange-100 text-orange-700";
        case "PREPARING": return "bg-blue-100 text-blue-700";
        case "OUT_FOR_DELIVERY": return "bg-purple-100 text-purple-700";
        case "COMPLETED": return "bg-green-100 text-green-700";
        case "CANCELLED": return "bg-red-100 text-red-700";
        default: return "bg-gray-100 text-gray-700";
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case "PENDING": return "Pendiente";
        case "PREPARING": return "Preparando";
        case "OUT_FOR_DELIVERY": return "En Camino";
        case "COMPLETED": return "Completado";
        case "CANCELLED": return "Cancelado";
        default: return status;
    }
};

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/orders")
            .then(r => r.json())
            .then(data => { setOrders(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const filtered = orders.filter(o => {
        const matchesQuery =
            o.id.slice(-6).toLowerCase().includes(query.toLowerCase()) ||
            (o.customerName || "").toLowerCase().includes(query.toLowerCase()) ||
            (o.address || "").toLowerCase().includes(query.toLowerCase());
        const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
        return matchesQuery && matchesStatus;
    });

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            {/* Header */}
            <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Pedidos</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Revisa y actualiza el estado de los pedidos.</p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar por folio, cliente, dirección..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 bg-white text-gray-700 font-medium text-sm"
                >
                    <option value="ALL">Todos los estados</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="PREPARING">Preparando</option>
                    <option value="OUT_FOR_DELIVERY">En Camino</option>
                    <option value="COMPLETED">Completado</option>
                    <option value="CANCELLED">Cancelado</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                                    <th className="px-4 md:px-6 py-4">ID / Fecha</th>
                                    <th className="px-4 md:px-6 py-4">Cliente / Dirección</th>
                                    <th className="px-4 md:px-6 py-4">Items</th>
                                    <th className="px-4 md:px-6 py-4">Total</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Estado</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-slate-700">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">
                                            No se encontraron pedidos{query ? ` para "${query}"` : ""}
                                        </td>
                                    </tr>
                                ) : filtered.map((order: any) => (
                                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 md:px-6 py-4">
                                            <div className="font-bold text-gray-900">#{order.id.slice(-6).toUpperCase()}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {new Date(order.createdAt).toLocaleDateString("es-MX", {
                                                    day: "2-digit", month: "short", year: "numeric"
                                                })} · {new Date(order.createdAt).toLocaleTimeString("es-MX", {
                                                    hour: "2-digit", minute: "2-digit"
                                                })}
                                            </div>
                                        </td>

                                        <td className="px-4 md:px-6 py-4">
                                            <div className="font-bold text-gray-800">{order.customerName || "Invitado"}</div>
                                            <div className="text-xs text-gray-500 mt-1">{order.address}</div>
                                        </td>

                                        <td className="px-4 md:px-6 py-4 text-sm font-medium">
                                            {order.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) ?? 0} items
                                        </td>

                                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">
                                            ${order.total.toFixed(2)}
                                        </td>

                                        <td className="px-4 md:px-6 py-4 text-center">
                                            <span className={`inline-block px-3 py-1.5 text-xs font-bold rounded-lg ${getStatusColor(order.status)}`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </td>

                                        <td className="px-4 md:px-6 py-4">
                                            <div className="flex items-center justify-center gap-3">
                                                <OrderStatusUpdate orderId={order.id} currentStatus={order.status} />
                                                <OrderDeleteButton orderId={order.id} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">
                        {filtered.length} de {orders.length} pedidos
                        {query && ` · Buscando "${query}"`}
                    </span>
                    <span className="text-gray-500 font-medium">
                        Total en pantalla: ${filtered.reduce((s: number, o: any) => s + o.total, 0).toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );
}
