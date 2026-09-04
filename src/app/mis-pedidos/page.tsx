"use client"

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2, ClipboardList, CheckCircle2, Trash2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { BottomNav } from "@/components/layout/bottom-nav";

type MyOrder = {
    id: string;
    status: string;
    total: number;
    createdAt: string;
    items: { product: { name: string; image?: string | null }; quantity: number; price: number }[];
};

const ACTIVE = ["PENDING", "PREPARING", "OUT_FOR_DELIVERY"];

const STATUS_LABEL: Record<string, string> = {
    PENDING: "Pendiente",
    PREPARING: "Preparando",
    OUT_FOR_DELIVERY: "En camino",
    COMPLETED: "Entregado",
    CANCELLED: "Cancelado",
};

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        PENDING: "bg-orange-100 text-orange-700",
        PREPARING: "bg-blue-100 text-blue-700",
        OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
        COMPLETED: "bg-green-100 text-green-700",
        CANCELLED: "bg-red-100 text-red-700",
    };
    return (
        <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-full ${map[status] || "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABEL[status] || status}
        </span>
    );
}

function OrderCard({ order, highlight, onDeleted }: { order: MyOrder; highlight?: boolean; onDeleted?: (id: string) => void }) {
    const folio = order.id.slice(-6).toUpperCase();
    // Pedidos en curso no se pueden "eliminar" -- perdería el rastro de una
    // entrega activa. Solo aplica al historial (ya completado/cancelado).
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/hide`, { method: "POST" });
            if (res.ok) onDeleted?.(order.id);
            else setDeleting(false);
        } catch {
            setDeleting(false);
        }
    };

    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 mb-3 transition-opacity ${deleting ? "opacity-40" : ""} ${highlight
            ? "bg-primary/5 border-primary/40 shadow-[0_4px_20px_rgba(238,43,52,0.15)]"
            : "bg-white border-gray-100 shadow-sm"}`}>
            <div className="flex justify-between items-start">
                <div>
                    {highlight && (
                        <span className="inline-block mb-1 text-[10px] font-black uppercase tracking-wider text-primary">
                            ● En curso
                        </span>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">#{folio}</span>
                        <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {new Date(order.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                </div>
                <p className="font-black text-primary">${order.total.toFixed(2)}</p>
            </div>

            <div className="text-sm text-gray-700 flex flex-col gap-1">
                {order.items.map((it, i) => (
                    <div key={i} className="flex justify-between">
                        <span>{it.quantity} × {it.product.name}</span>
                        <span className="text-gray-500 font-medium">${(it.price * it.quantity).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between mt-1">
                <Link href={`/tracking?orderId=${order.id}`} className="text-sm font-semibold text-primary hover:underline">
                    Ver seguimiento →
                </Link>

                {onDeleted && !confirming && (
                    <button
                        onClick={() => setConfirming(true)}
                        disabled={deleting}
                        aria-label="Eliminar pedido"
                        className="p-2 -m-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
                {onDeleted && confirming && (
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">¿Eliminar?</span>
                        <button onClick={handleDelete} disabled={deleting} className="font-bold text-red-500">
                            {deleting ? <Loader2 className="animate-spin" size={14} /> : "Sí"}
                        </button>
                        <button onClick={() => setConfirming(false)} disabled={deleting} className="text-gray-400">No</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function MyOrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paid = searchParams.get("paid"); // "1" = pago con tarjeta aprobado, "cash" = pedido a pagar en efectivo
    const { user } = useAuthStore();
    const [orders, setOrders] = useState<MyOrder[]>([]);
    const [loading, setLoading] = useState(true);
    // Aviso de confirmación que se ve justo al llegar aquí recién pagado --
    // se retira solo después de unos segundos.
    const [showPaidBanner, setShowPaidBanner] = useState(!!paid);

    useEffect(() => {
        if (!paid) return;
        const t = setTimeout(() => setShowPaidBanner(false), 5000);
        return () => clearTimeout(t);
    }, [paid]);

    useEffect(() => {
        fetch("/api/orders/mine")
            .then((r) => {
                if (r.status === 401 || r.status === 403) { router.push("/login"); return null; }
                return r.json();
            })
            .then((data) => { if (Array.isArray(data)) setOrders(data); setLoading(false); })
            .catch(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const active = orders.filter(o => ACTIVE.includes(o.status));
    const history = orders.filter(o => !ACTIVE.includes(o.status));

    return (
        <main className="min-h-[100dvh] bg-background pb-24">
            <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/10 px-4 py-4 flex items-center gap-3">
                <Link href="/" className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
                    <ChevronLeft size={24} />
                </Link>
                <div className="flex-1">
                    <h1 className="font-bold text-lg text-foreground">Mis pedidos</h1>
                    <p className="text-xs text-gray-500">{user?.name || ""}</p>
                </div>
            </header>

            {showPaidBanner && (
                <div className="mx-4 mt-4 px-5 py-4 rounded-2xl bg-green-500 text-white shadow-[0_10px_30px_rgba(34,197,94,0.4)] flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <CheckCircle2 size={24} className="shrink-0" />
                    <p className="font-bold text-sm leading-snug">
                        {paid === "cash" ? "¡Pedido confirmado! Pagas en efectivo al recibir." : "¡Tu pago fue realizado con éxito!"}
                    </p>
                </div>
            )}

            <div className="p-4 flex flex-col gap-6">
                {loading ? (
                    <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-3">
                        <ClipboardList size={44} />
                        <p className="font-semibold">Aún no tienes pedidos</p>
                        <Link href="/" className="text-primary font-semibold text-sm">Ir a la tienda</Link>
                    </div>
                ) : (
                    <>
                        <section>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                Pedido actual {active.length > 0 && `(${active.length})`}
                            </h2>
                            {active.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No tienes pedidos en curso.</p>
                            ) : (
                                active.map((o, idx) => <OrderCard key={o.id} order={o} highlight={idx === 0} />)
                            )}
                        </section>
                        <section>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                Historial {history.length > 0 && `(${history.length})`}
                            </h2>
                            {history.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">Todavía no hay historial.</p>
                            ) : (
                                history.map(o => (
                                    <OrderCard
                                        key={o.id}
                                        order={o}
                                        onDeleted={(id) => setOrders(prev => prev.filter(x => x.id !== id))}
                                    />
                                ))
                            )}
                        </section>
                    </>
                )}
            </div>
            <BottomNav />
        </main>
    );
}

export default function MyOrdersPage() {
    return (
        <Suspense fallback={<div className="min-h-[100dvh] bg-background flex justify-center items-center"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
            <MyOrdersContent />
        </Suspense>
    );
}
