"use client"

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { DriverLoginForm } from "@/components/auth/driver-login-form";
import { Bike, MapPin, Package, LogOut, Loader2, Navigation, CheckCircle2, Radio, X } from "lucide-react";

type OrderItem = { id: string; quantity: number; product: { name: string } };
type DriverOrder = {
    id: string;
    address: string | null;
    customerName: string | null;
    total: number;
    status: string;
    items: OrderItem[];
};

function OrderCard({ order, action }: { order: DriverOrder; action: React.ReactNode }) {
    const folio = order.id.slice(-6).toUpperCase();
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Folio #{folio}</p>
                    <p className="text-white font-bold">{order.customerName || "Cliente"}</p>
                </div>
                <p className="text-primary font-black text-lg">${order.total.toFixed(2)}</p>
            </div>

            <div className="flex items-start gap-2 text-sm text-gray-300">
                <MapPin size={16} className="shrink-0 mt-0.5 text-gray-400" />
                <span>{order.address || "Sin dirección"}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-400">
                <Package size={16} className="shrink-0" />
                <span>{itemCount} artículo{itemCount === 1 ? "" : "s"}</span>
            </div>

            {action}
        </div>
    );
}

export default function DriverPage() {
    const { user, logout } = useAuthStore();

    const [available, setAvailable] = useState<DriverOrder[]>([]);
    const [mine, setMine] = useState<DriverOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [gpsActive, setGpsActive] = useState(false);
    const watchIdRef = useRef<number | null>(null);
    const [mounted, setMounted] = useState(false);
    const [codeModalOrderId, setCodeModalOrderId] = useState<string | null>(null);
    const [codeInput, setCodeInput] = useState("");
    const [codeError, setCodeError] = useState("");

    useEffect(() => setMounted(true), []);

    const fetchOrders = useCallback(async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`/api/driver/orders?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setAvailable(data.available || []);
                setMine(data.mine || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id || user.role !== "DELIVERY") return;
        fetchOrders();
        const interval = setInterval(fetchOrders, 5000);
        return () => clearInterval(interval);
    }, [user, fetchOrders]);

    // Share GPS live while there's at least one order out for delivery.
    useEffect(() => {
        const hasActiveRoute = mine.some(o => o.status === "OUT_FOR_DELIVERY");

        if (hasActiveRoute && watchIdRef.current === null && navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                ({ coords }) => {
                    setGpsActive(true);
                    fetch("/api/driver/location", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: user?.id, lat: coords.latitude, lng: coords.longitude }),
                    }).catch(() => { });
                },
                () => setGpsActive(false),
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
            );
        }

        if (!hasActiveRoute && watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
            setGpsActive(false);
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [mine, user?.id]);

    const acceptOrder = async (orderId: string) => {
        if (!user?.id) return;
        setBusyId(orderId);
        try {
            const res = await fetch(`/api/driver/orders/${orderId}/accept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || "No se pudo aceptar el pedido");
            }
            fetchOrders();
        } finally {
            setBusyId(null);
        }
    };

    const updateStatus = async (orderId: string, status: string, deliveryCode?: string): Promise<string | null> => {
        setBusyId(orderId);
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(deliveryCode !== undefined ? { status, deliveryCode } : { status }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return data.error || "No se pudo actualizar el pedido";
            }
            fetchOrders();
            return null;
        } finally {
            setBusyId(null);
        }
    };

    // Al marcar como entregado, el repartidor debe capturar el código que el
    // cliente le da. El servidor valida que coincida antes de confirmar la
    // entrega. Antes esto era un window.prompt() (25/09, Mike: "esta muy
    // feo y no ocupa poner el nombre de cremeriadelrancho.com") -- ahora es
    // un modal propio, con el estilo oscuro/rojo del resto de la app.
    const handleComplete = (orderId: string) => {
        setCodeInput("");
        setCodeError("");
        setCodeModalOrderId(orderId);
    };

    const confirmarEntrega = async () => {
        if (!codeModalOrderId) return;
        const code = codeInput.trim();
        if (!code) {
            setCodeError("Escribe el código que te dio el cliente");
            return;
        }
        const error = await updateStatus(codeModalOrderId, "COMPLETED", code);
        if (error) {
            setCodeError(error);
            return;
        }
        setCodeModalOrderId(null);
    };

    if (!mounted) return null;

    // Sin sesión de reparto: el login sale AQUÍ mismo, directo al abrir la zona
    // de repartidores. Antes esta pantalla era un cartel ("Zona de
    // repartidores" + botón "Iniciar sesión") que había que picar para recién
    // llegar al formulario -- un paso de más, y peor en la calle con una sola
    // mano.
    if (!user || user.role !== "DELIVERY") {
        return (
            <main className="min-h-[100dvh] bg-[#0b0f19] flex flex-col items-center justify-center gap-5 px-4 py-10">
                <DriverLoginForm />
                {/* Si ya hay sesión pero no es de reparto (p. ej. un cliente que
                    entró por el menú), se avisa: si no, el formulario se ve
                    igual y no se entiende por qué su cuenta no entra aquí. */}
                {user && (
                    <p className="max-w-[420px] text-center text-xs text-gray-400">
                        Estás conectado como {user.name || user.email || "otra cuenta"}.{" "}
                        <button onClick={() => logout()} className="text-primary font-bold hover:underline">
                            Cerrar sesión
                        </button>{" "}
                        para entrar con tu cuenta de repartidor.
                    </p>
                )}
            </main>
        );
    }

    return (
        <main className="min-h-[100dvh] bg-[#121212] text-white pb-10">
            <header className="sticky top-0 z-10 bg-[#121212]/90 backdrop-blur-md border-b border-white/10 px-5 py-4 flex justify-between items-center">
                <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Repartidor</p>
                    <h1 className="text-lg font-bold">{user.name || "Hola"}</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${gpsActive ? "bg-green-500/15 text-green-400" : "bg-white/10 text-gray-400"}`}>
                        <Radio size={12} className={gpsActive ? "animate-pulse" : ""} />
                        {gpsActive ? "GPS activo" : "GPS inactivo"}
                    </div>
                    <button
                        onClick={() => logout()}
                        className="p-2.5 rounded-full bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Salir"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <div className="px-5 py-5 space-y-8">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : (
                    <>
                        {/* Mis entregas */}
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
                                Mis entregas {mine.length > 0 && `(${mine.length})`}
                            </h2>
                            {mine.length === 0 ? (
                                <p className="text-gray-500 text-sm italic">No tienes pedidos asignados.</p>
                            ) : (
                                <div className="space-y-3">
                                    {mine.map(order => (
                                        <OrderCard
                                            key={order.id}
                                            order={order}
                                            action={
                                                order.status === "PREPARING" ? (
                                                    <button
                                                        disabled={busyId === order.id}
                                                        onClick={async () => {
                                                            const error = await updateStatus(order.id, "OUT_FOR_DELIVERY");
                                                            if (error) alert(error);
                                                        }}
                                                        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/30 disabled:opacity-60"
                                                    >
                                                        {busyId === order.id ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                                                        Salí a entregar
                                                    </button>
                                                ) : (
                                                    <button
                                                        disabled={busyId === order.id}
                                                        onClick={() => handleComplete(order.id)}
                                                        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-600/30 disabled:opacity-60"
                                                    >
                                                        {busyId === order.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                                        Marcar entregado
                                                    </button>
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Disponibles */}
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
                                Pedidos disponibles {available.length > 0 && `(${available.length})`}
                            </h2>
                            {available.length === 0 ? (
                                <p className="text-gray-500 text-sm italic">No hay pedidos esperando repartidor por ahora.</p>
                            ) : (
                                <div className="space-y-3">
                                    {available.map(order => (
                                        <OrderCard
                                            key={order.id}
                                            order={order}
                                            action={
                                                <button
                                                    disabled={busyId === order.id}
                                                    onClick={() => acceptOrder(order.id)}
                                                    className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl border border-white/10 disabled:opacity-60"
                                                >
                                                    {busyId === order.id ? <Loader2 size={18} className="animate-spin" /> : <Bike size={18} />}
                                                    Aceptar pedido
                                                </button>
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {codeModalOrderId && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-white font-bold text-lg">Ingresar código</h2>
                            <button
                                onClick={() => setCodeModalOrderId(null)}
                                aria-label="Cerrar"
                                className="p-1.5 -mr-1.5 text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">Pídele al cliente el código de entrega y escríbelo aquí.</p>

                        <input
                            autoFocus
                            inputMode="numeric"
                            value={codeInput}
                            onChange={(e) => { setCodeInput(e.target.value); setCodeError(""); }}
                            onKeyDown={(e) => { if (e.key === "Enter") confirmarEntrega(); }}
                            placeholder="Código de entrega"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg font-bold tracking-widest placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-500 outline-none focus:border-primary"
                        />
                        {codeError && <p className="text-red-400 text-xs font-semibold mt-2">{codeError}</p>}

                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => setCodeModalOrderId(null)}
                                className="flex-1 py-3 rounded-xl font-bold text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmarEntrega}
                                disabled={busyId === codeModalOrderId}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-center bg-primary hover:bg-primary-hover transition-colors disabled:opacity-60"
                            >
                                {busyId === codeModalOrderId ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <CheckCircle2 size={18} className="shrink-0" />}
                                <span>Confirmar</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
