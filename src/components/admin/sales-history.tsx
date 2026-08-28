"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search, Filter, History, X, Bike, CreditCard } from "lucide-react";

type OrderItem = {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    product: { id: string; name: string } | null;
};

type Order = {
    id: string;
    customerName: string | null;
    address: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
    delivery?: { id: string; name: string | null } | null;
    items: OrderItem[];
};

function getStatusColor(status: string) {
    switch (status) {
        case "COMPLETED": return "bg-green-100 text-green-700";
        case "CANCELLED": return "bg-red-100 text-red-700";
        default: return "bg-gray-100 text-gray-700";
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case "COMPLETED": return "Venta Exitosa";
        case "CANCELLED": return "Cancelado";
        default: return status;
    }
}

const MONTH_LABELS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function SalesHistory({ orders }: { orders: Order[] }) {
    const [query, setQuery] = useState("");
    const [month, setMonth] = useState<string>("");
    const [selected, setSelected] = useState<Order | null>(null);

    const availableMonths = useMemo(() => {
        const map = new Map<string, number>();
        for (const o of orders) {
            const d = new Date(o.createdAt);
            if (Number.isNaN(d.getTime())) continue;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!map.has(key)) map.set(key, d.getMonth());
        }
        return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [orders]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return orders.filter((o) => {
            if (month) {
                const d = new Date(o.createdAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                if (key !== month) return false;
            }
            if (!q) return true;
            if (o.id.toLowerCase().includes(q)) return true;
            if (o.id.slice(-6).toLowerCase() === q) return true;
            if ((o.customerName || "").toLowerCase().includes(q)) return true;
            return false;
        });
    }, [orders, query, month]);

    const totalRevenue = useMemo(
        () => filtered.filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.total, 0),
        [filtered]
    );

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            <div className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Historial de Ventas</h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Registro de ventas finalizadas y pedidos cancelados.</p>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 px-6 py-3 rounded-2xl flex items-center gap-4 w-full md:w-auto">
                    <div className="p-2 bg-green-500 text-white rounded-xl">
                        <History size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-green-700 font-bold uppercase tracking-wider">Ingresos Totales</p>
                        <p className="text-lg font-black text-green-600">${totalRevenue.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar venta por ID de pedido o cliente..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                <div className="relative w-full md:w-auto">
                    <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="appearance-none w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors font-medium cursor-pointer"
                    >
                        <option value="">Filtros Mensuales</option>
                        {availableMonths.map(([key]) => {
                            const [y, m] = key.split("-");
                            return (
                                <option key={key} value={key}>
                                    {MONTH_LABELS[Number(m) - 1]} {y}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                                <th className="px-4 md:px-6 py-4">ID Pedido / Fecha</th>
                                <th className="px-4 md:px-6 py-4">Cliente / DirecciÃ³n</th>
                                <th className="px-4 md:px-6 py-4">Items</th>
                                <th className="px-4 md:px-6 py-4">Total</th>
                                <th className="px-4 md:px-6 py-4 text-center">Estado Final</th>
                                <th className="px-4 md:px-6 py-4 text-center">Ticket</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-slate-700">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-gray-400 italic">
                                        {orders.length === 0
                                            ? "No hay historial de ventas registrado aun."
                                            : "No se encontraron ventas con el filtro seleccionado."}
                                    </td>
                                </tr>
                            ) : filtered.map((order) => (
                                <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors group ${order.status === "CANCELLED" ? "opacity-60" : ""}`}>
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="font-bold text-gray-900">#{order.id.slice(-6).toUpperCase()}</div>
                                        <div className="text-xs md:text-sm text-gray-500 mt-1">{order.createdAt}</div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="font-bold text-gray-800">{order.customerName || "Invitado"}</div>
                                        <div className="text-xs md:text-sm text-gray-500 mt-1">{order.address}</div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-sm font-medium">
                                        {order.items.reduce((acc, item) => acc + item.quantity, 0)} items
                                    </td>
                                    <td className="px-4 md:px-6 py-4 font-bold text-gray-900">${order.total.toFixed(2)}</td>
                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <span className={`inline-block px-3 py-1.5 text-xs font-bold rounded-lg ${getStatusColor(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <button
                                            onClick={() => setSelected(order)}
                                            className="p-2 text-gray-400 hover:text-primary transition-colors"
                                            title="Ver Ticket"
                                        >
                                            <ExternalLink size={18} className="mx-auto" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Mostrando {filtered.length} registros</span>
                </div>
            </div>

            {selected && (
                <TicketModal
                    order={selected}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}

function TicketModal({ order, onClose }: { order: Order; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gray-900 px-6 py-5 flex justify-between items-center">
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Ticket de Venta</p>
                        <h3 className="text-white font-black text-lg mt-0.5">#{order.id.slice(-6).toUpperCase()}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="text-sm text-gray-600 leading-relaxed">
                        <p><span className="font-bold text-gray-800">Cliente:</span> {order.customerName || "Invitado"}</p>
                        <p><span className="font-bold text-gray-800">Direccion:</span> {order.address}</p>
                        <p>
                            <span className="font-bold text-gray-800">Metodo:</span>{" "}
                            {order.paymentMethod === "CARD" ? (
                                <span className="inline-flex items-center gap-1"><CreditCard size={14} /> Tarjeta</span>
                            ) : (
                                <span className="inline-flex items-center gap-1"><History size={14} /> Efectivo</span>
                            )}
                        </p>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Productos</p>
                        <ul className="divide-y divide-gray-50">
                            {order.items.map((item) => (
                                <li key={item.id} className="flex justify-between items-center py-2">
                                    <div className="min-w-0 pr-3">
                                        <p className="font-semibold text-gray-800 truncate">
                                            {item.product?.name || "Producto"}
                                        </p>
                                        <p className="text-xs text-gray-400">{item.quantity} x ${item.price.toFixed(2)}</p>
                                    </div>
                                    <p className="font-bold text-gray-900 shrink-0">${(item.price * item.quantity).toFixed(2)}</p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                        <p className="font-bold text-gray-800">Total</p>
                        <p className="font-black text-2xl text-gray-900">${order.total.toFixed(2)}</p>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className={`inline-block px-3 py-1.5 text-xs font-bold rounded-lg ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                        </span>
                        {order.delivery?.name && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                                <Bike size={14} /> {order.delivery.name}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
