"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2, Eye, EyeOff, Bike, User as UserIcon, ArrowRight } from "lucide-react";

// Login del portal Repartidor en su propio componente porque se muestra en DOS
// pantallas: /login?portal=repartidor (el repartidor que entra por el menú) y
// /driver, donde ahora sale directo al abrir la zona de reparto. Antes /driver
// mostraba un cartel con un botón "Iniciar sesión" que había que picar primero
// para recién ver el formulario -- un paso de más, y peor en la calle con una
// mano. Una sola copia del formulario = una sola pantalla que mantener.
//
// A propósito NO trae registro ni selector de portal: la cuenta de repartidor
// la crea el admin desde su panel (AddDriverButton) y nadie se auto-registra
// como repartidor.
export function DriverLoginForm() {
    const { setUser } = useAuthStore();
    const router = useRouter();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    // El ojito: esta contraseña se teclea en la calle, con el sol y el teclado
    // encima -- sin poder revisarla, un typo es un viaje perdido.
    const [showPassword, setShowPassword] = useState(false);
    // Marcado por default: el repartidor entra todos los días desde el mismo
    // celular. Sin marcar, la cookie dura lo que dure el navegador abierto.
    const [remember, setRemember] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ identifier, password, remember })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al iniciar sesión");
                return;
            }

            setUser(data);
            // El rol manda: una cuenta que no sea de reparto no se queda viendo
            // la zona de repartidores (el API la rechazaría igual).
            router.push(
                data.role === "ADMIN" ? "/admin"
                : data.role === "DELIVERY" ? "/driver"
                : "/tienda"
            );
        } catch {
            setError("Ocurrió un error inesperado al conectar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[420px] flex flex-col items-center gap-6">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_3px_rgba(52,211,153,0.55)] animate-pulse" />

            <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-[#141a29] border border-emerald-400/30 shadow-[0_0_30px_-6px_rgba(52,211,153,0.35)] flex items-center justify-center">
                    <Bike size={40} className="text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary border-4 border-[#0b0f19]" />
            </div>

            <div className="text-center">
                <h1 className="text-2xl font-black text-white">Cremería del Rancho</h1>
                <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase mt-1">Portal Repartidores</p>
            </div>

            <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 bg-[#141a29] border border-white/5 rounded-3xl p-6 shadow-2xl">
                {error && (
                    <div className="bg-red-500/10 text-red-400 text-sm font-medium p-3 rounded-xl text-center border border-red-500/20">
                        {error}
                    </div>
                )}

                <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-gray-300">Usuario</label>
                    <div className="relative">
                        <input
                            type="text"
                            required
                            placeholder="repartidor@correo.com o ID"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full bg-[#0f1522] border border-white/10 rounded-xl px-4 py-3 pr-10 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder:text-gray-500 font-medium"
                        />
                        <UserIcon size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                </div>

                <div className="space-y-1.5 text-left">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-gray-300">Contraseña</label>
                        <button
                            type="button"
                            onClick={() => router.push("/forgot-password")}
                            className="text-xs font-bold text-primary hover:text-primary-hover transition-colors"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#0f1522] border border-white/10 rounded-xl px-4 py-3 pr-10 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder:text-gray-500 font-medium tracking-widest"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-sm text-gray-300 font-medium">Recordar sesión</span>
                </label>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold rounded-xl h-14 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-[0.98] mt-2"
                >
                    {loading ? <Loader2 size={22} className="animate-spin" /> : <>INICIAR SESIÓN <ArrowRight size={18} /></>}
                </button>
            </form>
        </div>
    );
}

