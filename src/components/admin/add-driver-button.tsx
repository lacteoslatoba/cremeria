"use client"
import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddDriverButton() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, username, phone, password, role: "DELIVERY" })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Error al crear el repartidor");
                return;
            }

            setOpen(false);
            setName(""); setUsername(""); setPhone(""); setPassword("");
            router.refresh();
        } catch {
            setError("Ocurrió un error inesperado.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button onClick={() => setOpen(true)} className="flex items-center justify-center w-full md:w-auto gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5">
                <Plus size={20} />
                <span>Nuevo Repartidor</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-900">Nuevo Repartidor</h3>
                            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre Completo</label>
                                <input
                                    type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej. Carlos Martínez"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Usuario (para iniciar sesión)</label>
                                <input
                                    type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                                    placeholder="carlos.repartidor"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Celular</label>
                                <input
                                    type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                                    placeholder="555 123 4567"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Contraseña temporal</label>
                                <input
                                    type="text" required value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Contraseña de acceso"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 font-medium text-sm p-3 rounded-lg text-center border border-red-200">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit" disabled={loading}
                                className="w-full bg-primary hover:bg-primary-hover text-white font-bold text-base rounded-xl py-4 shadow-lg shadow-primary/30 disabled:opacity-70 transition-all flex justify-center items-center mt-6"
                            >
                                {loading ? <Loader2 size={24} className="animate-spin" /> : "Crear cuenta de repartidor"}
                            </button>
                            <p className="text-xs text-gray-400 text-center">
                                Comparte el usuario y contraseña con el repartidor para que entre en /driver
                            </p>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
