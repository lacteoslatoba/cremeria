"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";


export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [mounted, setMounted] = useState(false);

    // If user is already logged in (not as guest), redirect to home
    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const authStr = localStorage.getItem("auth-storage");
            if (authStr) {
                try {
                    const auth = JSON.parse(authStr);
                    if (auth.state?.user && auth.state.user.role !== "GUEST") {
                        router.push("/");
                    }
                } catch (e) { }
            }
        }
    }, [router]);

    // Form fields
    const [identifier, setIdentifier] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Developer helper (show code in toast since we don't have real SMS/Email hooked up)
    const [devCode, setDevCode] = useState("");

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setDevCode("");

        try {
            const res = await fetch("/api/auth/forgot-password/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al solicitar código");
                return;
            }

            // Show dev code if returned (only for prototype)
            if (data._dev_code) {
                setDevCode(data._dev_code);
            }

            setStep(2);
        } catch (err) {
            setError("Error de conexión. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/forgot-password/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, code })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Código inválido");
                return;
            }

            setStep(3);
        } catch (err) {
            setError("Error de conexión. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/forgot-password/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, code, newPassword: password })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "No se pudo actualizar la contraseña");
                return;
            }

            setStep(4);
        } catch (err) {
            setError("Error de conexión. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <main className="font-sans antialiased min-h-[100dvh]" style={{ background: "radial-gradient(circle at 50% 50%, #fff 0%, #f9fafb 100%)" }}>
            <div className="relative flex min-h-[100dvh] w-full flex-col">
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

                <div className="relative z-10 flex flex-col justify-center min-h-[100dvh] px-6 py-10">
                    <div className="flex flex-col w-full max-w-[440px] mx-auto gap-6 z-20 bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-[0_20px_60px_rgb(0,0,0,0.06)] relative overflow-hidden">

                        {/* Status bar / Steps indicator */}
                        {step < 4 && (
                            <div className="absolute top-0 left-0 right-0 h-1.5 flex bg-gray-100">
                                <div className={`h-full bg-primary transition-all duration-500 ease-in-out ${step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'}`} />
                            </div>
                        )}

                        <div className="flex justify-center mb-2 mt-2 text-primary">
                            {step === 4 ? (
                                <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center text-green-500 mb-2">
                                    <CheckCircle2 size={40} />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <KeyRound size={32} />
                                </div>
                            )}
                        </div>

                        <div className="text-center mb-2">
                            <h2 className="text-2xl font-bold text-[#2d2a28] tracking-tight">
                                {step === 1 && "Recuperar Contraseña"}
                                {step === 2 && "Verificar Código"}
                                {step === 3 && "Nueva Contraseña"}
                                {step === 4 && "¡Contraseña Actualizada!"}
                            </h2>
                            <p className="text-sm font-medium text-gray-500 mt-2">
                                {step === 1 && "Ingresa tu usuario, email o número de teléfono registrado y te enviaremos un código."}
                                {step === 2 && `Ingresa el código de 6 dígitos que fue enviado a ${identifier}.`}
                                {step === 3 && "Crea una nueva contraseña segura para tu cuenta."}
                                {step === 4 && "Tu contraseña ha sido cambiada de forma segura. Ya puedes acceder a tu cuenta."}
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 font-medium text-sm p-4 rounded-xl flex items-center gap-3 border border-red-100">
                                <AlertCircle size={18} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {devCode && step === 2 && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm mb-2 relative overflow-hidden group">
                                <div className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                    Código de Prueba (Simulador SMS)
                                </div>
                                El código generado para recuperar tu cuenta es: <strong className="text-lg tracking-widest bg-amber-200/50 px-2 rounded">{devCode}</strong>
                            </div>
                        )}

                        {/* Step 1: Request Code */}
                        {step === 1 && (
                            <form onSubmit={handleRequestCode} className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#2d2a28]/70 uppercase tracking-wider pl-1">Usuario, Correo o Celular</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej. pedrito123, 555-1234, etc."
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] font-medium"
                                    />
                                </div>
                                <button type="submit" disabled={loading || !identifier} className="w-full relative overflow-hidden mt-4 rounded-2xl h-14 flex items-center justify-center bg-primary text-white font-bold tracking-widest shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100">
                                    {loading ? <Loader2 className="animate-spin" /> : "ENVIAR CÓDIGO"}
                                </button>
                            </form>
                        )}

                        {/* Step 2: Verify Code */}
                        {step === 2 && (
                            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#2d2a28]/70 uppercase tracking-wider pl-1 text-center block">Código de Verificación</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        placeholder="000000"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} // only numbers
                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] font-black tracking-[0.5em] text-center text-2xl"
                                    />
                                </div>
                                <button type="submit" disabled={loading || code.length !== 6} className="w-full relative overflow-hidden mt-4 rounded-2xl h-14 flex items-center justify-center bg-primary text-white font-bold tracking-widest shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100">
                                    {loading ? <Loader2 className="animate-spin" /> : "VERIFICAR CÓDIGO"}
                                </button>
                                <button type="button" onClick={() => { setStep(1); setCode(""); setDevCode(""); }} className="text-sm text-gray-400 hover:text-gray-700 font-medium transition-colors text-center mt-2">
                                    Solicitar nuevo código
                                </button>
                            </form>
                        )}

                        {/* Step 3: New Password */}
                        {step === 3 && (
                            <form onSubmit={handleResetPassword} className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-1 relative">
                                    <label className="text-xs font-bold text-[#2d2a28]/70 uppercase tracking-wider pl-1">Nueva Contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] font-medium tracking-widest pr-10"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1 relative">
                                    <label className="text-xs font-bold text-[#2d2a28]/70 uppercase tracking-wider pl-1">Confirmar Contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] font-medium tracking-widest pr-10"
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading || !password || !confirmPassword} className="w-full relative overflow-hidden mt-4 rounded-2xl h-14 flex items-center justify-center bg-primary text-white font-bold tracking-widest shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100">
                                    {loading ? <Loader2 className="animate-spin" /> : "GUARDAR CONTRASEÑA"}
                                </button>
                            </form>
                        )}

                        {/* Step 4: Success */}
                        {step === 4 && (
                            <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300 mt-4">
                                <Link href="/login" className="w-full rounded-2xl h-14 flex items-center justify-center bg-[#2d2a28] text-white font-bold tracking-widest shadow-lg shadow-gray-900/20 transition-all active:scale-[0.98]">
                                    INICIAR SESIÓN
                                </Link>
                            </div>
                        )}

                    </div>

                    {step < 4 && (
                        <div className="flex justify-center mt-8 z-20">
                            <Link href="/login" className="flex items-center gap-2 text-sm font-bold text-[#2d2a28]/60 hover:text-[#2d2a28] transition-colors bg-white/50 backdrop-blur-md px-5 py-2.5 rounded-full border border-white">
                                <ArrowLeft size={16} /> Volver al Inicio de Sesión
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
