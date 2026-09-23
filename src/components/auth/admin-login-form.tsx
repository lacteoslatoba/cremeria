"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2, Eye, EyeOff, ShieldCheck, User as UserIcon, Lock, ArrowRight } from "lucide-react";

// Login del portal Control Panel, en su propio componente igual que
// DriverLoginForm (mismo patrón: sin registro, sin selector de portal --
// la cuenta ADMIN no se auto-crea). Diseño oscuro a pedido del usuario
// (mockup pegado en el chat, tipo "panel de seguridad"), adaptado a los
// componentes/colores que ya existen en el proyecto (lucide-react en vez
// de Material Symbols, sin Tailwind CDN) en vez de copiar el HTML suelto.
export function AdminLoginForm() {
    const { user, setUser, logout } = useAuthStore();
    const router = useRouter();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
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
                body: JSON.stringify({ identifier, password, remember: true })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al iniciar sesión");
                return;
            }

            setUser(data);
            // El rol manda: una cuenta que no sea ADMIN no se queda viendo el
            // Control Panel (el API la rechazaría igual al pedir datos).
            router.push(
                data.role === "ADMIN" ? "/admin"
                : data.role === "DELIVERY" ? "/driver"
                : "/"
            );
        } catch {
            setError("Ocurrió un error inesperado al conectar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[420px] flex flex-col items-center gap-6">
            <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-[#121215] border border-zinc-800 shadow-2xl shadow-cyan-950/20 flex items-center justify-center">
                    <ShieldCheck size={34} className="text-primary" />
                </div>
            </div>

            <div className="text-center space-y-2">
                <h1 className="text-2xl font-black text-white">Panel de Administración</h1>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-zinc-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[11px] font-mono font-medium tracking-wide text-zinc-400 uppercase">Acceso seguro · encriptado</span>
                </div>
            </div>

            <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 bg-[#121215] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
                {error && (
                    <div className="bg-red-500/10 text-red-400 text-sm font-medium p-3 rounded-xl text-center border border-red-500/20">
                        {error}
                    </div>
                )}

                <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-zinc-400">Usuario</label>
                    <div className="relative">
                        <UserIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            required
                            autoComplete="off"
                            name="cp-usuario"
                            placeholder="Ingresa tu usuario"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full bg-[#18181b] border border-zinc-800 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder:text-zinc-600 font-medium"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 text-left">
                    {/* Sin "olvidaste tu contraseña" a propósito: las cuentas
                        ADMIN no se recuperan por código -- el dueño del
                        negocio resetea la contraseña directo en la base de
                        datos cuando hace falta (igual que se creó esta
                        cuenta), no por un flujo público de recuperación. */}
                    <label className="text-xs font-bold text-zinc-400">Contraseña</label>
                    <div className="relative">
                        <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            autoComplete="current-password"
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#18181b] border border-zinc-800 rounded-xl pl-10 pr-10 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder:text-zinc-600 font-medium tracking-widest"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold rounded-xl h-14 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-[0.98] mt-2"
                >
                    {loading ? <Loader2 size={22} className="animate-spin" /> : <>INICIAR SESIÓN <ArrowRight size={18} /></>}
                </button>
            </form>

            {/* Los 3 portales comparten una sola cookie de sesión -- si ya hay
                una sesión de Cliente/Repartidor abierta, hace falta cerrarla
                antes de poder entrar como admin. Sin este aviso, entrar aquí
                con otra sesión activa "no hacía nada" (rebotaba en silencio
                a la tienda) y parecía un bug. */}
            {user && user.role !== "ADMIN" && (
                <p className="max-w-[380px] text-center text-xs text-zinc-500">
                    Estás conectado como {user.name || user.email || "otra cuenta"}.{" "}
                    <button onClick={() => logout()} className="text-primary font-bold hover:underline">
                        Cerrar sesión
                    </button>{" "}
                    para entrar con tu cuenta de administrador.
                </p>
            )}

            <footer className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono">
                    <Lock size={13} />
                    <span>Conexión segura TLS · panel protegido</span>
                </div>
                <p className="text-[11px] text-zinc-600">Acceso exclusivo para personal autorizado</p>
            </footer>
        </div>
    );
}
