"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2, Milk, User } from "lucide-react";

export default function LoginPage() {
    const { user, setUser } = useAuthStore();
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
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
                body: JSON.stringify({ email: email.toLowerCase(), name })
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
        <main className="min-h-screen bg-background text-foreground flex flex-col justify-center px-6 relative overflow-hidden">
            {/* Shapes Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-3xl rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 blur-3xl rounded-full -ml-32 -mb-32"></div>

            <div className="max-w-[400px] w-full mx-auto relative z-10">
                <div className="flex justify-center mb-8 relative">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-xl flex items-center justify-center -rotate-6">
                        <User size={48} className="text-primary drop-shadow-md" />
                    </div>
                    <div className="absolute -bottom-4 right-1/4 w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center rotate-12 shadow-lg shadow-primary/30">
                        <Milk size={24} />
                    </div>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black mb-2 tracking-tight">Bienvenido</h1>
                    <p className="text-gray-400 font-medium">Ingresa tus datos para empezar a comprar.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-300 pl-1">Nombre Completo</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej. María Sánchez"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-gray-900 placeholder:text-gray-400 font-medium"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-300 pl-1">Correo Electrónico (Tu Usuario base)</label>
                        <input
                            type="email"
                            required
                            placeholder="maria@correo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-gray-900 placeholder:text-gray-400 font-medium"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 text-red-500 font-medium text-sm p-4 rounded-xl text-center border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold text-lg rounded-2xl py-4 shadow-[0_4px_20px_rgba(238,43,52,0.4)] disabled:opacity-70 transition-all flex justify-center items-center gap-2 mt-4"
                    >
                        {loading ? <Loader2 size={24} className="animate-spin" /> : "Entrar a la Tienda"}
                    </button>

                    <p className="text-center text-xs text-gray-500 mt-6 font-medium">
                        Si tu cuenta no existe, serás registrado automáticamente o un administrador aprobará tu entrada según las políticas de la sucursal.
                    </p>
                </form>
            </div>
        </main>
    );
}
