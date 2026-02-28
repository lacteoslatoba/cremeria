"use client"
import { useState } from "react";
import { Edit, Trash2, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function CustomerActions({ user }: { user: any }) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [name, setName] = useState(user.name || "");
    const [email, setEmail] = useState(user.email || "");
    const [phone, setPhone] = useState(user.phone || "");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const handleDelete = async () => {
        if (!confirm(`¿Estás seguro de que deseas eliminar al cliente ${user.name || "sin nombre"}? Sus pedidos se seguirán mostrando en el historial de ventas.`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                router.refresh();
            } else {
                alert("Ocurrió un error al eliminar el cliente.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone, role: user.role })
            });

            const data = await res.json();

            if (res.ok) {
                setIsEditing(false);
                router.refresh();
            } else {
                setError(data.error || "Error al actualizar cliente.");
            }
        } catch (error) {
            console.error(error);
            setError("Error de red.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex items-center justify-center gap-2">
            <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar Cliente"
            >
                <Edit size={18} />
            </button>
            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Eliminar Cliente"
            >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-left">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-900">Editar Cliente</h3>
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-200">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Cliente</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Correo (Login)</label>
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Celular / Teléfono</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-primary hover:bg-primary-hover text-white font-bold text-base rounded-xl py-4 shadow-lg shadow-primary/30 disabled:opacity-70 transition-all flex justify-center items-center mt-6"
                            >
                                {isSaving ? <Loader2 size={24} className="animate-spin" /> : "Guardar Cambios"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
