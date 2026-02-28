"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const { user, setUser } = useAuthStore();
    const router = useRouter();
    const [name, setName] = useState("");
    const [identifier, setIdentifier] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (user) {
            router.push("/");
        }
    }, [user, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: identifier, name: name })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al iniciar sesión");
                return;
            }

            setUser(data);
            router.push("/");
        } catch (err) {
            setError("Ocurrió un error inesperado al conectar.");
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <main className="font-sans antialiased bg-[#1c1917] overflow-hidden">
            <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="w-full h-full bg-center bg-no-repeat bg-cover opacity-100" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDW4g867N7VJcFkYYE5DJSkSyKB16IAdb1mMme14rjI0pSt44LN_m4zd_r2cl75Ztod5_nXQeS5VlWoWe7hKs0-qVdILjKsyDB9humTMcznRcBxEORiPQwoXfOo8sFvfWHrU3bLUvqWyKa2Ty8mGvDQD0MEKjK4oEsQkig9vgNwBEdeU_vKweku0VGiV9k9yy0ccQjZBgG4CJiCnXYiBb5mRAgDCUHvJDGUD_8TzqKydV1cwBKX5KeIZOt0DlDIaBwNn8b_1F4tjt8Q')" }}>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90"></div>
                </div>

                <div className="relative z-10 flex flex-col justify-between h-full min-h-[100dvh] px-6 py-10">
                    <div className="flex justify-center pt-2">
                        <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xl">
                            <img alt="La Toba Logo" className="h-16 w-auto object-contain" src="https://i.ibb.co/qMMcGwNr/a2.png" />
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-start pt-8 flex-grow text-center">
                        <h1 className="text-white tracking-tight text-5xl font-black leading-[1.1] drop-shadow-md">
                            Cremeria <br />
                            <span className="text-primary italic">del Rancho</span>
                        </h1>
                        <p className="mt-3 text-white/90 text-lg font-medium italic tracking-widest drop-shadow-md">
                            Lo nuestro es calidad
                        </p>
                    </div>

                    <div className="flex flex-col w-full max-w-[480px] mx-auto gap-6 z-20 bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl mb-4">
                        <form onSubmit={handleLogin} className="flex flex-col gap-4">

                            <div className="space-y-1 text-left">
                                <label className="text-xs font-bold text-white/80 pl-1 uppercase tracking-wider">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. María Sánchez"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder:text-white/40 font-medium"
                                />
                            </div>

                            <div className="space-y-1 text-left">
                                <label className="text-xs font-bold text-white/80 pl-1 uppercase tracking-wider">Acceso</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Correo o Celular"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder:text-white/40 font-medium"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/20 text-red-200 font-medium text-sm p-4 rounded-xl text-center border border-red-500/30 backdrop-blur-md">
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={loading} className="relative group w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-16 px-8 flex bg-primary text-white text-lg font-bold leading-normal tracking-[0.2em] shadow-[0_0_20px_rgba(238,43,52,0.4)] transition-all active:scale-[0.98] mt-2">
                                <span className="relative z-10 flex items-center gap-2">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : "ENTRAR"}
                                </span>
                                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-full transition-all duration-1000"></div>
                            </button>

                            <p className="text-center text-[11px] text-white/50 mt-2 font-medium">
                                Si no tienes cuenta, serás registrado de forma automática al ingresar.
                            </p>
                        </form>
                    </div>
                </div>

                <div className="fixed pointer-events-none inset-0 z-0">
                    <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-black/80 to-transparent"></div>
                </div>
            </div>
        </main>
    );
}
