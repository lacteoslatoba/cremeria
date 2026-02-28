"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Image as ImageIcon, Save } from "lucide-react";
import Link from "next/link";

export function ProductForm({ existingProduct = null }: { existingProduct?: any }) {
    const router = useRouter();
    const isEditing = !!existingProduct;

    const [form, setForm] = useState({
        name: existingProduct?.name || "",
        category: existingProduct?.category || "Lácteos",
        price: existingProduct?.price || "",
        stock: existingProduct?.stock || "",
        description: existingProduct?.description || "",
        image: existingProduct?.image || "",
        status: existingProduct?.status || "ACTIVE"
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const payload = {
                ...form,
                price: parseFloat(form.price as string),
                stock: parseInt(form.stock as string, 10),
            };

            const url = isEditing ? `/api/products/${existingProduct.id}` : "/api/products";
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Ocurrió un error al guardar el producto.");
                setLoading(false);
                return;
            }

            router.push("/admin");
            router.refresh();
        } catch (error) {
            setError("Error de red. Intenta nuevamente.");
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full bg-[#f8f9fa]">
            <div className="max-w-3xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin" className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-colors shadow-sm">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                            {isEditing ? `Editar Producto` : "Nuevo Producto"}
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">
                            {isEditing ? "Modifica los detalles del producto seleccionado." : "Llena los detalles para dar de alta un producto al inventario."}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-200">
                            {error}
                        </div>
                    )}

                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Nombre */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Producto *</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="Ej. Queso Oaxaca Fresco"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            {/* Categoría */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Categoría *</label>
                                <select
                                    name="category"
                                    required
                                    value={form.category}
                                    onChange={handleChange}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 bg-white"
                                >
                                    <option value="Lácteos">Lácteos</option>
                                    <option value="Carnes">Carnes Frías</option>
                                    <option value="Abarrotes">Abarrotes</option>
                                    <option value="Panadería">Panadería</option>
                                    <option value="Bebidas">Bebidas</option>
                                </select>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Estado Público *</label>
                                <select
                                    name="status"
                                    required
                                    value={form.status}
                                    onChange={handleChange}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 bg-white"
                                >
                                    <option value="ACTIVE">Activo (Visible)</option>
                                    <option value="INACTIVE">Inactivo (Oculto)</option>
                                </select>
                            </div>

                            {/* Precio */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Precio de Venta ($) *</label>
                                <input
                                    type="number"
                                    name="price"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={form.price}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            {/* Stock */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Inventario Inicial (Unidades) *</label>
                                <input
                                    type="number"
                                    name="stock"
                                    required
                                    min="0"
                                    step="1"
                                    value={form.stock}
                                    onChange={handleChange}
                                    placeholder="50"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                />
                            </div>

                            {/* Imagen */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-2">URL de la Imagen (Opcional)</label>
                                <div className="flex gap-4">
                                    <div className="relative flex-1">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <ImageIcon size={18} />
                                        </div>
                                        <input
                                            type="url"
                                            name="image"
                                            value={form.image}
                                            onChange={handleChange}
                                            placeholder="https://ejemplo.com/imagen.jpg"
                                            className="w-full pl-10 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900"
                                        />
                                    </div>
                                    {form.image && (
                                        <img src={form.image} alt="Preview" className="w-12 h-12 rounded-xl object-cover shrink-0 border border-gray-200 shadow-sm" />
                                    )}
                                </div>
                            </div>

                            {/* Descripción */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Descripción (Opcional)</label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Describe brevemente el producto..."
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 resize-none"
                                ></textarea>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                            <Link href="/admin" className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/30 transition-all disabled:opacity-70"
                            >
                                {loading && <Loader2 size={20} className="animate-spin" />}
                                {!loading && <Save size={20} />}
                                <span>{isEditing ? "Guardar Cambios" : "Crear Producto"}</span>
                            </button>
                        </div>

                    </div>
                </form>
            </div>
        </div>
    );
}
