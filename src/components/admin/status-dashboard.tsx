"use client";

// Panel "Estado" del administrador: resumen operativo de la cremeria con
// graficas. No trae ninguna libreria de charts de terceros (recharts/d3/etc.)
// -- los SVG se dibujan a mano para no inflar el bundle ni anadir
// dependencias; es la misma filosofia del resto del UI (Tailwind + componentes
// propios). Toda la informacion se deriva de las consultas que ya hace el
// servidor en /admin (orders, salesOrders, products, customers), asi que no se
// necesita ninguna llamada extra ni red.

import { useMemo } from "react";
import {
    ShoppingCart, Package, Users, TrendingUp, Bike, CheckCircle2,
    XCircle, Clock, type LucideIcon,
} from "lucide-react";

/* Tipos (lenos: acomodan lo que ya trae page.tsx como props) */

type Item = {
    quantity: number;
    price?: number;
    product?: { id?: string; name?: string | null } | null;
};

type StatusOrder = {
    id: string;
    status: string;
    total: number;
    createdAt: string | Date;
    paymentMethod?: string;
    paymentStatus?: string;
    items?: Item[] | null;
};

type StatusDashboardProps = {
    orders: StatusOrder[];
    productsCount: number;
    productsInStock: number;
    customersCount: number;
};

/* Paleta / etiquetas por estado (coinciden con el resto del panel) */

const STATUS_META: Record<string, { label: string; color: string; badge: string }> = {
    PENDING:          { label: "Pendientes",          color: "#f59e0b", badge: "bg-amber-100 text-amber-700" },
    PREPARING:        { label: "En preparación",      color: "#3b82f6", badge: "bg-blue-100 text-blue-700" },
    OUT_FOR_DELIVERY: { label: "En reparto",          color: "#8b5cf6", badge: "bg-violet-100 text-violet-700" },
    COMPLETED:        { label: "Entregados",          color: "#22c55e", badge: "bg-green-100 text-green-700" },
    CANCELLED:        { label: "Cancelados",          color: "#ef4444", badge: "bg-red-100 text-red-700" },
};

const STATUS_ORDER = ["PENDING", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"];

const WEEKDAY = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const fmtMXN = (n: number) => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Componente principal ──

export function StatusDashboard({ orders, productsCount, productsInStock, customersCount }: StatusDashboardProps) {
    const stats = useMemo(() => {
        const byStatus = STATUS_ORDER.map((s) => ({ status: s, count: orders.filter((o) => o.status === s).length }));
        const completedRevenue = orders.filter((o) => o.status === "COMPLETED").reduce((sum, o) => sum + (o.total || 0), 0);
        const pending = orders.filter((o) => o.status === "PENDING").length;
        const inDelivery = orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
        const completed = orders.filter((o) => o.status === "COMPLETED").length;
        const cancelled = orders.filter((o) => o.status === "CANCELLED").length;

        // Actividad por día (últimos 7 días, de más viejo a más reciente).
        const days: { label: string; count: number }[] = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const count = orders.filter((o) => {
                const c = new Date(o.createdAt);
                return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}` === key;
            }).length;
            // WEEKDAY está en orden Lun..Dom; getDay() es 0=Dom, por eso el +6 %7.
            days.push({ label: WEEKDAY[(d.getDay() + 6) % 7], count });
        }

        return { byStatus, completedRevenue, pending, inDelivery, completed, cancelled, days };
    }, [orders]);

    const totalOrders = orders.length;
    const maxStatus = Math.max(1, ...stats.byStatus.map((s) => s.count));
    const maxDay = Math.max(1, ...stats.days.map((d) => d.count));

    const kpis: { label: string; value: string; icon: LucideIcon; tone: string }[] = [
        { label: "Pedidos", value: String(totalOrders), icon: ShoppingCart, tone: "text-amber-600 bg-amber-50" },
        { label: "En stock", value: `${productsInStock}/${productsCount}`, icon: Package, tone: "text-blue-600 bg-blue-50" },
        { label: "Clientes", value: String(customersCount), icon: Users, tone: "text-violet-600 bg-violet-50" },
        { label: "Ingresos", value: fmtMXN(stats.completedRevenue), icon: TrendingUp, tone: "text-green-600 bg-green-50" },
    ];

    const mini: { label: string; value: number; icon: LucideIcon; color: string }[] = [
        { label: "Pendientes", value: stats.pending, icon: Clock, color: "#f59e0b" },
        { label: "En reparto", value: stats.inDelivery, icon: Bike, color: "#8b5cf6" },
        { label: "Entregados", value: stats.completed, icon: CheckCircle2, color: "#22c55e" },
        { label: "Cancelados", value: stats.cancelled, icon: XCircle, color: "#ef4444" },
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* KPIs principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                    <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
                        <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${k.tone}`}>
                            <k.icon size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{k.label}</div>
                            <div className="text-xl font-black text-gray-900 truncate">{k.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Resumen operativo por estado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {mini.map((m) => (
                    <div key={m.label} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-3">
                        <m.icon size={20} color={m.color} />
                        <div>
                            <div className="text-2xl font-black text-gray-900 leading-none">{m.value}</div>
                            <div className="text-xs font-semibold text-gray-400 mt-1">{m.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pedidos por estado */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 mb-5">Pedidos por estado</h3>
                <div className="flex flex-col gap-4">
                    {stats.byStatus.map(({ status, count }) => {
                        const meta = STATUS_META[status];
                        return (
                            <div key={status} className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${meta.badge}`}>{meta.label}</span>
                                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxStatus) * 100}%`, backgroundColor: meta.color }} />
                                </div>
                                <span className="w-7 text-right font-bold text-gray-900 text-sm shrink-0">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Actividad · últimos 7 días */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 mb-5">Pedidos · últimos 7 días</h3>
                <div className="flex items-end justify-between gap-2 h-40">
                    {stats.days.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-gray-700 leading-none">{d.count > 0 ? d.count : ""}</span>
                            <div
                                className="w-full max-w-[40px] rounded-t-md bg-primary/70"
                                style={{ height: `${d.count > 0 ? Math.max(8, (d.count / maxDay) * 80) : 3}%` }}
                            />
                            <span className="text-[11px] font-semibold text-gray-400 leading-none">{d.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
