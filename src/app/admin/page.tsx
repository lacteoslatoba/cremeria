"use client"

import { useState, useEffect } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import Link from "next/link";
import { ProductActions } from "@/components/admin/product-actions";

export default function AdminInventoryPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/products?admin=true")
            .then(r => r.json())
            .then(data => { setProducts(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        p.id.slice(-6).toLowerCase().includes(query.toLowerCase())
    );

    const getTagColor = (category: string) => {
        switch (category) {
            case "Lácteos": return "bg-blue-100 text-blue-700 border-blue-200";
            case "Carnes": return "bg-red-100 text-red-700 border-red-200";
            case "Abarrotes": return "bg-amber-100 text-amber-700 border-amber-200";
            case "Panadería": return "bg-green-100 text-green-700 border-green-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            {/* Header */}
            <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Inventario</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Gestiona los productos disponibles en tienda.</p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-row items-center gap-3 mb-6">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar por nombre, categoría, SKU..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                <Link
                    href="/admin/products/new"
                    className="flex items-center justify-center w-[46px] h-[46px] bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 shrink-0"
                    title="Agregar Producto"
                >
                    <Plus size={24} />
                </Link>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                                    <th className="px-4 md:px-6 py-4">Producto</th>
                                    <th className="px-4 md:px-6 py-4">Categoría</th>
                                    <th className="px-4 md:px-6 py-4">Precio (Venta)</th>
                                    <th className="px-4 md:px-6 py-4">Stock</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                                            No se encontraron productos para &quot;{query}&quot;
                                        </td>
                                    </tr>
                                ) : filtered.map((product: any) => (
                                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 md:px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <img
                                                    src={product.image || "https://images.unsplash.com/photo-1542838132-92c53300491e"}
                                                    alt={product.name}
                                                    className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover shadow-sm border border-gray-100 shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-gray-900 truncate">{product.name}</h4>
                                                    <p className="text-xs text-gray-500 font-medium">SKU: {product.id.slice(-6).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 md:px-6 py-4">
                                            <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md border ${getTagColor(product.category)}`}>
                                                {product.category}
                                            </span>
                                        </td>

                                        <td className="px-4 md:px-6 py-4 font-semibold text-gray-900">
                                            ${product.price.toFixed(2)}
                                        </td>

                                        <td className="px-4 md:px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${product.stock === 0 ? "text-red-500" : "text-gray-700"}`}>
                                                    {product.stock} un.
                                                </span>
                                                {product.stock === 0 && (
                                                    <span className="px-2 py-0.5 text-[10px] font-black bg-red-100 text-red-600 border border-red-200 rounded-full uppercase tracking-wider">
                                                        Agotado
                                                    </span>
                                                )}
                                                {product.stock > 0 && product.stock <= 15 && (
                                                    <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-600 border border-amber-200 rounded-full uppercase tracking-wider">
                                                        Poco stock
                                                    </span>
                                                )}
                                                {product.stock > 15 && (
                                                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 md:px-6 py-4">
                                            <ProductActions productId={product.id} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">
                        {filtered.length} de {products.length} productos
                        {query && ` · Buscando "${query}"`}
                    </span>
                </div>
            </div>
        </div>
    );
}
