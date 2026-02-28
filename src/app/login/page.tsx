"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const { user, setUser } = useAuthStore();
    const router = useRouter();

    const [isRegistering, setIsRegistering] = useState(false);

    const handleGuestLogin = () => {
        setUser({ id: "guest", name: "Invitado", email: null, phone: null, role: "GUEST" });
        router.push("/");
    };

    // Login State
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");

    // Register State
    const [regName, setRegName] = useState("");
    const [regUsername, setRegUsername] = useState("");
    const [regPhone, setRegPhone] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regConfirmPassword, setRegConfirmPassword] = useState("");
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

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
                body: JSON.stringify({ identifier, password })
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

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (regPassword !== regConfirmPassword) {
            setError("Las contraseñas no coinciden");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: regName,
                    username: regUsername,
                    phone: regPhone,
                    email: regEmail,
                    password: regPassword
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al registrarse");
                return;
            }

            // Enter session immediately
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
        <main className="font-sans antialiased overflow-y-auto overflow-x-hidden min-h-[100dvh]" style={{ background: "radial-gradient(circle at 50% 50%, #fff 0%, #f9fafb 100%)" }}>
            <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden">
                <div className="fixed inset-0 z-0">
                    <div className="absolute inset-0" style={{
                        backgroundImage: "url(https://lh3.googleusercontent.com/aida-public/AB6AXuCk-86BX5m8rJtfnpBeucRNCOEXlT0kL1nxNJhrtamKf4_cd1y8c4VlHzgEpyUv-yhZh4xah0Mr9lBPbkJ4yNdxfPxBJXxDuRKT3i9W-v7LxwY-XlZySEBXbChnSBB3X_VZmVQs_UH7QaxUMJEO8IMWnlm8IZtozXpCIfExWMnDTCTUz8nPHVuYn1XEg4v1F99zrUTVaHh_7ACLqL3VfVgxNwYpqyKNyRQLGHd4arYD5slwwDj3kMziH-3ZQ5T7_jvWhuNDxTy98iiv)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        opacity: 0.08,
                        filter: "grayscale(40%) contrast(90%)",
                        mixBlendMode: "multiply"
                    }}></div>
                    <div className="absolute inset-0" style={{
                        backgroundImage: "url(https://lh3.googleusercontent.com/aida-public/AB6AXuARSHF88XEMPgG-YromyIEau96ck20nFhp36acDO42qPciNQlHuB5-TLLDu377LPEKfL9fJxm2dPae_lSc5p4uSf15q9nzmjuTZMW8JI9WIQH7lIUUN3ifESzF5bKS98kqddHIbY3U1aNiu7t6t3VjFkLYYnpbqxhsdNF1kRGVzGXpkxC8OUoZ9FHF8Kt72lH7wO9_wSTnWMYJHIglfw8638NvR7rrn-H9Tb_elNz-nYrvJquIEFJQozdiID4oXa8rnARr-DUNk-4lg)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        opacity: 0.05,
                        mixBlendMode: "luminosity"
                    }}></div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/60 via-transparent to-white/40"></div>
                </div>

                <div className="relative z-10 flex flex-col justify-between min-h-[100dvh] px-6 py-10 pt-2 pb-24">
                    <div className="flex justify-center pt-8">
                        <div className="flex items-center justify-center p-3">
                            <img alt="La Toba Logo" className="h-20 w-auto object-contain" src="https://i.ibb.co/qMMcGwNr/a2.png" />
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-start pt-4 pb-6 text-center">
                        <h1 className="text-[#2d2a28] font-serif tracking-tight text-5xl font-bold leading-[1.1]" style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.05)" }}>
                            Cremeria <br />
                            <span className="text-primary italic">del Rancho</span>
                        </h1>
                        <p className="mt-3 text-[#2d2a28] text-lg font-medium italic tracking-[0.15em] opacity-90 font-serif">
                            Lo nuestro es calidad
                        </p>
                    </div>

                    <div className="flex flex-col w-full max-w-[480px] mx-auto gap-6 z-20 bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
                        {!isRegistering ? (
                            <form onSubmit={handleLogin} className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Usuario - Celular</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ingresa tu usuario"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium"
                                    />
                                </div>

                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Contraseña</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium tracking-widest"
                                    />
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 font-medium text-sm p-4 rounded-xl text-center border border-red-200 backdrop-blur-md">
                                        {error}
                                    </div>
                                )}

                                <button type="submit" disabled={loading} className="relative group w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-16 px-8 flex bg-primary text-white text-lg font-bold leading-normal tracking-[0.2em] shadow-xl shadow-primary/30 transition-all active:scale-[0.98] mt-2">
                                    <span className="relative z-10 flex items-center gap-2">
                                        {loading ? <Loader2 size={24} className="animate-spin" /> : "ENTRAR"}
                                    </span>
                                    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-full transition-all duration-1000"></div>
                                </button>

                                <div className="text-center mt-2">
                                    <span className="text-sm text-[#2d2a28]/70 font-medium">Si no tienes cuenta aún, </span>
                                    <button
                                        type="button"
                                        onClick={() => { setError(""); setIsRegistering(true); }}
                                        className="text-sm text-primary hover:text-primary-hover font-bold transition-colors underline decoration-2 underline-offset-4"
                                    >
                                        crea tu cuenta
                                    </button>
                                </div>

                                <div className="flex justify-center mt-4 border-t border-gray-200/50 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleGuestLogin}
                                        className="text-sm text-[#2d2a28]/60 hover:text-[#2d2a28] font-medium transition-colors"
                                    >
                                        Entrar como invitado (solo explorar)
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleRegister} className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                                <h2 className="text-xl font-bold text-[#2d2a28] mb-2 text-center">Registro de Usuario</h2>

                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej. Pedro Pérez"
                                        value={regName}
                                        onChange={(e) => setRegName(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1 text-left">
                                        <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Usuario *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="pedrito123"
                                            value={regUsername}
                                            onChange={(e) => setRegUsername(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1 text-left">
                                        <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Teléfono</label>
                                        <input
                                            type="tel"
                                            placeholder="555-123-4567"
                                            value={regPhone}
                                            maxLength={12}
                                            onChange={(e) => {
                                                const cleaned = e.target.value.replace(/\D/g, '');
                                                let formatted = cleaned;
                                                if (cleaned.length > 3 && cleaned.length <= 6) {
                                                    formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
                                                } else if (cleaned.length > 6) {
                                                    formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
                                                }
                                                setRegPhone(formatted);
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Correo Electrónico</label>
                                    <input
                                        type="email"
                                        placeholder="pedro@ejemplo.com"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1 text-left relative">
                                        <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Contraseña *</label>
                                        <div className="relative">
                                            <input
                                                type={showRegPassword ? "text" : "password"}
                                                required
                                                placeholder="••••••••"
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium tracking-widest pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowRegPassword(!showRegPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                            >
                                                {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-left relative">
                                        <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Confirmar *</label>
                                        <div className="relative">
                                            <input
                                                type={showRegConfirmPassword ? "text" : "password"}
                                                required
                                                placeholder="••••••••"
                                                value={regConfirmPassword}
                                                onChange={(e) => setRegConfirmPassword(e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium tracking-widest pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                            >
                                                {showRegConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 font-medium text-sm p-3 rounded-lg text-center border border-red-200 backdrop-blur-md">
                                        {error}
                                    </div>
                                )}

                                <button type="submit" disabled={loading} className="relative group w-full cursor-pointer items-center justify-center rounded-xl h-14 px-8 flex bg-primary text-white text-base font-bold leading-normal tracking-wide shadow-xl shadow-primary/30 transition-all active:scale-[0.98] mt-2">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : "GUARDAR"}
                                </button>

                                <div className="text-center mt-2">
                                    <span className="text-sm text-[#2d2a28]/70 font-medium">Si ya tienes cuenta, </span>
                                    <button
                                        type="button"
                                        onClick={() => { setError(""); setIsRegistering(false); }}
                                        className="text-sm text-primary hover:text-primary-hover font-bold transition-colors underline decoration-2 underline-offset-4"
                                    >
                                        inicia sesión
                                    </button>
                                </div>

                                <div className="flex justify-center mt-2 border-t border-gray-200/50 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleGuestLogin}
                                        className="text-sm text-[#2d2a28]/60 hover:text-[#2d2a28] font-medium transition-colors"
                                    >
                                        Entrar como invitado (solo explorar)
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                <div className="fixed pointer-events-none inset-0 z-0">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/30 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-white/40 to-transparent"></div>
                </div>
            </div>
        </main>
    );
}
