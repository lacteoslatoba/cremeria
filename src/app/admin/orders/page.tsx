import { ExternalLink, Search, Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { OrderStatusUpdate } from "@/components/admin/order-status-update";

export default async function AdminOrdersPage() {
    const orders = await prisma.order.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PENDING": return "bg-orange-100 text-orange-700";
            case "PREPARING": return "bg-blue-100 text-blue-700";
            case "OUT_FOR_DELIVERY": return "bg-purple-100 text-purple-700";
            case "COMPLETED": return "bg-green-100 text-green-700";
            case "CANCELLED": return "bg-red-100 text-red-700";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "PENDING": return "Pendiente";
            case "PREPARING": return "Preparando";
            case "OUT_FOR_DELIVERY": return "En Camino";
            case "COMPLETED": return "Completado";
            case "CANCELLED": return "Cancelado";
            default: return status;
        }
    };

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            {/* Header */}
            <div className="mb-6 md:mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Pedidos Activos</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Revisa y actualiza el estado de los pedidos de tus clientes.</p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por ID de pedido o cliente..."
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
                                <th className="px-4 md:px-6 py-4">ID Pedido / Fecha</th>
                                <th className="px-4 md:px-6 py-4">Cliente / Dirección</th>
                                <th className="px-4 md:px-6 py-4">Items</th>
                                <th className="px-4 md:px-6 py-4">Total</th>
                                <th className="px-4 md:px-6 py-4 text-center">Estado</th>
                                <th className="px-4 md:px-6 py-4 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-slate-700">
                            {orders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">

                                    <td className="px-4 md:px-6 py-4">
                                        <div className="font-bold text-gray-900">#{order.id.slice(-6).toUpperCase()}</div>
                                        <div className="text-xs md:text-sm text-gray-500 mt-1">{order.createdAt.toLocaleTimeString()} - {order.createdAt.toLocaleDateString()}</div>
                                    </td>

                                    <td className="px-4 md:px-6 py-4">
                                        <div className="font-bold text-gray-800">{order.customerName || "Invitado"}</div>
                                        <div className="text-xs md:text-sm text-gray-500 mt-1">{order.address}</div>
                                    </td>

                                    <td className="px-4 md:px-6 py-4 text-sm font-medium">
                                        {order.items.reduce((acc: number, item: any) => acc + item.quantity, 0)} items
                                    </td>

                                    <td className="px-4 md:px-6 py-4 font-bold text-gray-900">
                                        ${order.total.toFixed(2)}
                                    </td>

                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <span className={`inline-block px-3 py-1.5 text-xs font-bold rounded-lg ${getStatusColor(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </td>

                                    <td className="px-4 md:px-6 py-4">
                                        <div className="flex items-center justify-center gap-3">
                                            <OrderStatusUpdate orderId={order.id} currentStatus={order.status} />

                                            <button className="p-2 text-gray-400 hover:text-primary transition-colors" title="Detalles">
                                                <ExternalLink size={18} />
                                            </button>
                                        </div>
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Mostrando {orders.length} pedidos</span>
                </div>
            </div>
        </div>
    );
}
