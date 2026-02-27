"use client"

import { ArrowLeft, Save, Loader2, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddProductPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        category: "Lácteos",
        price: "",
        stock: "",
        image: "",
        description: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    price: parseFloat(formData.price),
                    stock: parseInt(formData.stock, 10),
                })
            });

            if (res.ok) {
                router.push("/admin");
                router.refresh();
            } else {
                alert("Ocurrió un error al guardar el producto");
                setIsSubmitting(false);
            }
        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-[#f8f9fa]">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin" className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Agregar Nuevo Producto</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Ingresa los detalles para un alta de inventario.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Details (Left Col) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-100 pb-3">Información General</h3>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Nombre del Producto</label>
                            <input
                                required
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Ej: Queso Manchego 1kg"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:bg-white text-gray-900 font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Descripción (Opcional)</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Añade detalles del producto..."
                                rows={4}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:bg-white text-gray-900 font-medium resize-none"
                            ></textarea>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-100 pb-3">Inventario y Precio</h3>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Precio de Venta ($)</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:bg-white text-gray-900 font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Stock Inicial (Uds)</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    name="stock"
                                    value={formData.stock}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:bg-white text-gray-900 font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Side Panel (Right Col) */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-100 pb-3">Organización</h3>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Categoría</label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:bg-white text-gray-900 font-medium appearance-none"
                            >
                                <option value="Lácteos">Lácteos</option>
                                <option value="Carnes">Carnes</option>
                                <option value="Verduras">Verduras</option>
                                <option value="Panadería">Panadería</option>
                                <option value="Abarrotes">Abarrotes</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 border-b border-gray-100 pb-3">Imagen URL</h3>

                        <div>
                            <div className="w-full h-40 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 mb-4 overflow-hidden relative">
                                {formData.image ? (
                                    <img src={formData.image} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <ImageIcon size={32} className="mb-2" />
                                        <span className="text-xs font-semibold">Previsualización</span>
                                    </>
                                )}
                            </div>
                            <input
                                type="url"
                                name="image"
                                value={formData.image}
                                onChange={handleChange}
                                placeholder="https://ejemplo.com/imagen.jpg"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:bg-white text-sm text-gray-900 font-medium"
                            />
                        </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.push("/admin")}
                            className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Guardar
                        </button>
                    </div>
                </div>

            </form>
        </div>
    );
}
