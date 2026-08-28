"use client";

import { Save, Loader2, Image as ImageIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ProductFormModalProps = {
    open: boolean;
    productId: string | null; // null = crear nuevo, valor = editar
    onClose: () => void;
};

const initialForm = {
    name: "",
    category: "Lácteos",
    price: "",
    stock: "",
    image: "",
    description: "",
};

export function ProductFormModal({ open, productId, onClose }: ProductFormModalProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(!!productId);
    const [formData, setFormData] = useState(initialForm);

    // Al abrir el modal, si vamos a editar cargamos los datos actuales del producto.
    useEffect(() => {
        if (!open) return;
        if (!productId) {
            setFormData(initialForm);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        fetch(`/api/products/${productId}`)
            .then((res) => res.json())
            .then((data) => {
                if (!data.error) {
                    setFormData({
                        name: data.name || "",
                        category: data.category || "Lácteos",
                        price: data.price?.toString() || "",
                        stock: data.stock?.toString() || "",
                        image: data.image || "",
                        description: data.description || "",
                    });
                }
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, [open, productId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch(productId ? `/api/products/${productId}` : "/api/products", {
                method: productId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    price: parseFloat(formData.price),
                    stock: parseInt(formData.stock, 10),
                }),
            });

            if (res.ok) {
                onClose();
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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">
                            {productId ? "Editar Producto" : "Agregar Nuevo Producto"}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 font-medium">
                            {productId
                                ? "Actualiza los detalles de tu inventario."
                                : "Ingresa los detalles para un alta de inventario."}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-y-auto max-h-[70vh]">
                        {/* Main details */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-5">
                                <h4 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">Información General</h4>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Nombre del Producto</label>
                                    <input
                                        required
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Ej: Queso Manchego 1kg"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Descripción</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="Descripción breve del producto"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 font-medium resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Precio ($)</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            name="price"
                                            value={formData.price}
                                            onChange={handleChange}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Stock</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            step="1"
                                            name="stock"
                                            value={formData.stock}
                                            onChange={handleChange}
                                            placeholder="0"
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 font-medium"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Categoría</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-900 font-medium appearance-none"
                                    >
                                        <option value="Lácteos">Lácteos</option>
                                        <option value="Carnes">Carnes</option>
                                        <option value="Verduras">Verduras</option>
                                        <option value="Panadería">Panadería</option>
                                        <option value="Abarrotes">Abarrotes</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Image column */}
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-4">
                                <h4 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">Imagen URL</h4>
                                <div className="w-full h-40 bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 overflow-hidden relative">
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
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-gray-900 font-medium"
                                />
                            </div>
                        </div>

                        {/* Submit actions */}
                        <div className="lg:col-span-3 flex gap-4 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={onClose}
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
                    </form>
                )}
            </div>
        </div>
    );
}

