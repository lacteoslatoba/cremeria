import { Plus, Search, Filter } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductActions } from "@/components/admin/product-actions";
export default async function AdminInventoryPage() {
    const products = await prisma.product.findMany({
        orderBy: { createdAt: "desc" },
    });

    const getTagColor = (category: string) => {
        switch (category) {
            case "Lácteos": return "bg-blue-100 text-blue-700 border-blue-200";
            case "Carnes": return "bg-red-100 text-red-700 border-red-200";
            case "Abarrotes": return "bg-amber-100 text-amber-700 border-amber-200";
            case "Panadería": return "bg-green-100 text-green-700 border-green-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    }

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Inventario</h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Gestiona los productos disponibles en tienda (Altas y Bajas).</p>
                </div>

                <Link href="/admin/products/new" className="flex items-center justify-center w-full md:w-auto gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5">
                    <Plus size={20} />
                    <span>Agregar Producto</span>
                </Link>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, SKU o categoría..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors font-medium w-full md:w-auto">
                    <Filter size={18} />
                    <span>Filtros</span>
                </button>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
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
                            {products.map((product: any) => (
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
                                            <span className="font-bold text-gray-700">{product.stock} un.</span>
                                            {product.stock === 0 && (
                                                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Agotado"></span>
                                            )}
                                            {product.stock > 0 && product.stock <= 15 && (
                                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Poco stock"></span>
                                            )}
                                            {product.stock > 15 && (
                                                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="En stock"></span>
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

                {/* Pagination Footer (Static) */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
                    <span className="text-gray-500 font-medium text-center md:text-left">Mostrando {products.length} productos</span>
                    <div className="flex gap-2 w-full md:w-auto justify-center">
                        <button className="px-3 py-1 rounded bg-white border border-gray-200 text-gray-400 cursor-not-allowed flex-1 md:flex-none">Hacia Atrás</button>
                        <button className="px-3 py-1 rounded bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 flex-1 md:flex-none">Siguiente</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
