"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, KeyRound, ShieldCheck, User, Trash2, Loader2, Download } from "lucide-react";
import { OrderStatusUpdate } from "@/components/admin/order-status-update";
import { OrderDeleteButton } from "@/components/admin/order-delete-button";
import { AssignDriver } from "@/components/admin/assign-driver";
import { ProductActions } from "@/components/admin/product-actions";
import { CustomerActions } from "@/components/admin/customer-actions";
import { AdminDriversTable } from "@/components/admin/admin-drivers-table";
import { ProductFormModal } from "@/components/admin/product-form-modal";
import { SafeImage } from "@/components/ui/safe-image";

/* ───────────────────────────── TABS ───────────────────────────── */

export type AdminTab = "inventory" | "orders" | "sales" | "customers" | "drivers";

/* ─────────────────────── INVENTARIO ─────────────────────── */

const getTagColor = (category: string) => {
    switch (category) {
        case "Lácteos": return "bg-blue-100 text-blue-700 border-blue-200";
        case "Carnes": return "bg-red-100 text-red-700 border-red-200";
        case "Abarrotes": return "bg-amber-100 text-amber-700 border-amber-200";
        case "Panadería": return "bg-green-100 text-green-700 border-green-200";
        default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
};

export function AdminInventory({ products }: { products: any[] }) {
    const [query, setQuery] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    const openNew = () => { setEditId(null); setFormOpen(true); };
    const openEdit = (id: string) => { setEditId(id); setFormOpen(true); };

    const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        p.id.slice(-6).toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col w-full">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nombre, categoría, SKU..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                <button
                    onClick={openNew}
                    className="flex items-center justify-center gap-2 h-[46px] px-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 shrink-0"
                    title="Agregar Producto"
                >
                    <Plus size={20} />
                    <span className="hidden sm:inline">Agregar</span>
                </button>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                                <th className="px-4 md:px-6 py-4">Producto</th>
                                <th className="px-4 md:px-6 py-4">Categoría</th>
                                <th className="px-4 md:px-6 py-4">Precio</th>
                                <th className="px-4 md:px-6 py-4">Stock</th>
                                <th className="px-4 md:px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-gray-400 italic">No hay productos.</td>
                                </tr>
                            ) : filtered.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gray-50 overflow-hidden shrink-0">
                                                {product.image ? (
                                                    <SafeImage src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg font-black">C</div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-gray-900 truncate">{product.name}</h4>
                                                <p className="text-xs text-gray-500 font-medium">SKU: {product.id.slice(-6).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4">
                                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md border ${getTagColor(product.category)}`}>
                                            {product.category}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 font-semibold text-gray-900">${product.price.toFixed(2)}</td>
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${product.stock === 0 ? "text-red-500" : "text-gray-700"}`}>
                                                {product.stock} un.
                                            </span>
                                            {product.stock === 0 && (
                                                <span className="px-2 py-0.5 text-[10px] font-black bg-red-100 text-red-600 border border-red-200 rounded-full uppercase tracking-wider">Agotado</span>
                                            )}
                                            {product.stock > 0 && product.stock <= 15 && (
                                                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-600 border border-amber-200 rounded-full uppercase tracking-wider">Poco stock</span>
                                            )}
                                            {product.stock > 15 && (
                                                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <ProductActions productId={product.id} onEdit={openEdit} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">
                        {filtered.length} de {products.length} productos
                        {query && ` · Buscando "${query}"`}
                    </span>
                </div>
            </div>


            <ProductFormModal open={formOpen} productId={editId} onClose={() => setFormOpen(false)} />
        </div>
    );
}

/* ─────────────────────── PEDIDOS ─────────────────────── */

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

// Tabla reutilizable de pedidos (se usa tanto para el pedido actual como el historial).
function OrderTable({
    orders,
    emptyMsg,
    selected,
    onToggleRow,
    onToggleAll,
}: {
    orders: any[];
    emptyMsg: string;
    selected: Set<string>;
    onToggleRow: (id: string) => void;
    onToggleAll: (ids: string[], checked: boolean) => void;
}) {
    if (orders.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full py-12 text-center text-gray-400 font-medium">
                {emptyMsg}
            </div>
        );
    }
    const ids = orders.map((o) => o.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    const someSelected = !allSelected && ids.some((id) => selected.has(id));

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                        <th className="pl-4 md:pl-6 py-4 w-10">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                                onChange={(e) => onToggleAll(ids, e.target.checked)}
                                className="w-4 h-4 rounded accent-primary cursor-pointer"
                                aria-label="Seleccionar todos"
                            />
                        </th>
                        <th className="px-4 md:px-6 py-4">ID / Fecha</th>
                        <th className="px-4 md:px-6 py-4">Cliente / Dirección</th>
                        <th className="px-4 md:px-6 py-4">Items</th>
                        <th className="px-4 md:px-6 py-4">Total</th>
                        <th className="px-4 md:px-6 py-4 text-center">Estado</th>
                        <th className="px-4 md:px-6 py-4 text-center">Código entrega</th>
                        <th className="px-4 md:px-6 py-4 text-center">Repartidor</th>
                        <th className="px-4 md:px-6 py-4 text-center">Acción</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 text-slate-700">
                    {orders.map((order: any) => (
                        <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors ${selected.has(order.id) ? "bg-primary/5" : ""}`}>
                            <td className="pl-4 md:pl-6 py-4">
                                <input
                                    type="checkbox"
                                    checked={selected.has(order.id)}
                                    onChange={() => onToggleRow(order.id)}
                                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                                    aria-label={`Seleccionar pedido #${order.id.slice(-6).toUpperCase()}`}
                                />
                            </td>
                            <td className="px-4 md:px-6 py-4">
                                <div className="font-bold text-gray-900">#{order.id.slice(-6).toUpperCase()}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {new Date(order.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · {new Date(order.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </td>
                            <td className="px-4 md:px-6 py-4">
                                <div className="font-bold text-gray-800">{order.customerName || "Invitado"}</div>
                                <div className="text-xs text-gray-500 mt-1">{order.address}</div>
                            </td>
                            <td className="px-4 md:px-6 py-4 text-sm font-medium">
                                {order.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) ?? 0} items
                            </td>
                            <td className="px-4 md:px-6 py-4 font-bold text-gray-900">${order.total.toFixed(2)}</td>
                            <td className="px-4 md:px-6 py-4 text-center">
                                <span className={`inline-block px-3 py-1.5 text-xs font-bold rounded-lg ${getStatusColor(order.status)}`}>
                                    {getStatusLabel(order.status)}
                                </span>
                            </td>
                            <td className="px-4 md:px-6 py-4 text-center">
                                {order.deliveryCode ? (
                                    order.deliveryCodeStatus === "VERIFIED" ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-green-100 text-green-700" title="El repartidor confirmó este código con el cliente">
                                            <ShieldCheck size={13} /> Verificado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-gray-600 font-mono tracking-widest" title="Código que el cliente le da al repartidor para confirmar la entrega">
                                            <KeyRound size={13} /> {order.deliveryCode}
                                        </span>
                                    )
                                ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                )}
                            </td>
                            <td className="px-4 md:px-6 py-4 text-center">
                                <AssignDriver orderId={order.id} currentDeliveryId={order.deliveryId || null} />
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
    );
}


export function AdminOrders({ orders }: { orders: any[] }) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const filtered = orders.filter((o) => {
        const matchesQuery =
            o.id.slice(-6).toLowerCase().includes(query.toLowerCase()) ||
            (o.customerName || "").toLowerCase().includes(query.toLowerCase()) ||
            (o.address || "").toLowerCase().includes(query.toLowerCase());
        const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
        return matchesQuery && matchesStatus;
    });

    const ACTIVE_STATES = ["PENDING", "PREPARING", "OUT_FOR_DELIVERY"];
    // Un pedido con tarjeta que nunca se terminó de pagar (carrito
    // abandonado a medio checkout, tarjeta rechazada) no debe verse como
    // "pedido actual" -- prepararlo/entregarlo sería pérdida pura, nunca
    // se cobró. Efectivo siempre se aprueba al crearse (se paga al
    // recibir), asi que ahí "actual" solo depende del estado de entrega.
    const isRealPurchase = (o: any) => o.paymentMethod === "CASH" || o.paymentStatus === "APPROVED";
    const activeOrders = filtered.filter((o) => ACTIVE_STATES.includes(o.status) && isRealPurchase(o));
    // Todo lo demás cae en Historial -- incluye lo ya terminado y los
    // intentos de pago que nunca se completaron, para que nada desaparezca
    // de la vista, solo se reclasifique.
    const historyOrders = filtered.filter((o) => !(ACTIVE_STATES.includes(o.status) && isRealPurchase(o)));

    // Solo transacciones de Stripe que de verdad se cobraron -- ni efectivo
    // (no es "transacción" de tarjeta), ni pendientes/rechazadas (esas
    // nunca se cobraron de verdad, aunque hayan quedado registradas).
    const approvedStripeOrders = orders.filter((o) => o.paymentMethod === "STRIPE" && o.paymentStatus === "APPROVED");

    const escapeCsv = (v: unknown) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const handleExportStripe = () => {
        const rows = approvedStripeOrders.map((o) => [
            o.id.slice(-6).toUpperCase(),
            new Date(o.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }),
            new Date(o.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
            o.customerName || "Invitado",
            o.address || "",
            o.total.toFixed(2),
            o.stripePaymentIntentId || "",
        ]);
        const header = ["Folio", "Fecha", "Hora", "Cliente", "Dirección", "Total", "ID Stripe (PaymentIntent)"];
        // BOM al inicio -- sin esto Excel muestra mal los acentos/ñ del CSV.
        const csv = "﻿" + [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pedidos-stripe-aprobados-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const toggleRow = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = (ids: string[], checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const id of ids) { if (checked) next.add(id); else next.delete(id); }
            return next;
        });
    };

    // Selecciona/deselecciona TODO lo que está filtrado (ambas secciones a la
    // vez), no solo una tabla -- así "seleccionar todos" de verdad significa
    // todos los pedidos visibles, sin importar en qué sección estén.
    const allFilteredIds = filtered.map((o) => o.id);
    const allFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

    const handleBulkDelete = async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (!confirm(`¿Eliminar ${ids.length} pedido${ids.length > 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) return;

        setIsBulkDeleting(true);
        try {
            const results = await Promise.allSettled(
                ids.map((id) => fetch(`/api/orders/${id}`, { method: "DELETE" }))
            );
            const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
            if (failed.length > 0) {
                alert(`No se pudieron eliminar ${failed.length} de ${ids.length} pedidos. Intenta de nuevo.`);
            }
            setSelected(new Set());
            router.refresh();
        } finally {
            setIsBulkDeleting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col w-full">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por folio, cliente, dirección..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 bg-white text-gray-700 font-medium text-sm"
                >
                    <option value="ALL">Todos los estados</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="PREPARING">Preparando</option>
                    <option value="OUT_FOR_DELIVERY">En Camino</option>
                    <option value="COMPLETED">Completado</option>
                    <option value="CANCELLED">Cancelado</option>
                </select>
                <button
                    type="button"
                    onClick={handleExportStripe}
                    disabled={approvedStripeOrders.length === 0}
                    title="Descarga un CSV solo con los pedidos pagados con Stripe y aprobados de verdad"
                    className="flex items-center justify-center gap-2 h-[46px] px-4 bg-white border border-gray-200 hover:border-primary/40 text-gray-700 rounded-xl font-bold text-sm shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={18} />
                    <span className="hidden sm:inline">Descargar Stripe ({approvedStripeOrders.length})</span>
                    <span className="sm:hidden">({approvedStripeOrders.length})</span>
                </button>
            </div>

            {/* Barra de selección -- solo aparece con al menos un pedido marcado */}
            {selected.size > 0 && (
                <div className="flex items-center justify-between gap-3 mb-6 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={(e) => toggleAll(allFilteredIds, e.target.checked)}
                            className="w-4 h-4 rounded accent-primary cursor-pointer"
                        />
                        {selected.size} pedido{selected.size > 1 ? "s" : ""} seleccionado{selected.size > 1 ? "s" : ""}
                        {!allFilteredSelected && (
                            <button type="button" onClick={() => toggleAll(allFilteredIds, true)} className="text-primary hover:underline font-bold">
                                Seleccionar todos ({allFilteredIds.length})
                            </button>
                        )}
                    </label>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSelected(new Set())}
                            className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-60"
                        >
                            {isBulkDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Eliminar seleccionados
                        </button>
                    </div>
                </div>
            )}

            {/* Pedido actual */}
            <section className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Pedido actual {activeOrders.length > 0 && `(${activeOrders.length})`}
                </h3>
                <OrderTable
                    orders={activeOrders}
                    emptyMsg="No hay pedidos en curso."
                    selected={selected}
                    onToggleRow={toggleRow}
                    onToggleAll={toggleAll}
                />
            </section>

            {/* Historial */}
            <section className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Historial {historyOrders.length > 0 && `(${historyOrders.length})`}
                </h3>
                <OrderTable
                    orders={historyOrders}
                    emptyMsg="Todavía no hay historial de pedidos."
                    selected={selected}
                    onToggleRow={toggleRow}
                    onToggleAll={toggleAll}
                />
            </section>
        </div>
    );
}

/* ─────────────────────── CLIENTES ─────────────────────── */

export function AdminCustomers({ users }: { users: any[] }) {
    const [query, setQuery] = useState("");

    const filtered = users.filter(
        (u) =>
            (u.name || "").toLowerCase().includes(query.toLowerCase()) ||
            (u.email || "").toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col w-full">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nombre o correo electrónico..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                                <th className="px-4 md:px-6 py-4">Nombre y Usuario</th>
                                <th className="px-4 md:px-6 py-4">Correo</th>
                                <th className="px-4 md:px-6 py-4">Celular</th>
                                <th className="px-4 md:px-6 py-4 text-center">Pedidos</th>
                                <th className="px-4 md:px-6 py-4 text-center">Registro</th>
                                <th className="px-4 md:px-6 py-4 text-center">Estado</th>
                                <th className="px-4 md:px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-slate-700">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-gray-400 italic">No hay clientes registrados aún.</td>
                                </tr>
                            ) : filtered.map((u: any) => (
                                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {u.name ? u.name.charAt(0).toUpperCase() : <User size={18} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="font-bold text-gray-900">{u.name || "Sin nombre"}</div>
                                                {u.username && <div className="text-xs font-medium text-gray-400 mt-0.5">@{u.username}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 font-medium text-gray-700">{u.email}</td>
                                    <td className="px-4 md:px-6 py-4 font-medium text-gray-700">
                                        {u.phone || <span className="text-gray-400 italic">No registrado</span>}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center font-bold text-gray-900">
                                        {u._count?.orders ?? 0} <span className="text-xs font-normal text-gray-500 ml-1">compras</span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center text-sm text-gray-500">
                                        {new Date(u.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <span className="inline-block px-3 py-1.5 text-xs font-bold rounded-lg bg-green-100 text-green-700">ACTIVO</span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <CustomerActions user={u} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Mostrando {filtered.length} usuarios</span>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────── REPARTIDORES ─────────────────────── */

export function AdminDrivers({ drivers }: { drivers: any[] }) {
    return (
        <div className="flex-1 flex flex-col w-full">
            <AdminDriversTable
                drivers={drivers.map((d) => ({
                    id: d.id,
                    name: d.name,
                    username: d.username,
                    phone: d.phone,
                    locationUpdatedAt: d.locationUpdatedAt,
                    deliveryCount: d._count?.deliveryOrders ?? 0,
                }))}
            />
        </div>
    );
}

