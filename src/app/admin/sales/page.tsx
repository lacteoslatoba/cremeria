import { ExternalLink, Search, Filter, History } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function AdminSalesHistoryPage() {
    // Fetch only completed or cancelled orders for the history
    const orders = await prisma.order.findMany({
        where: {
            status: {
                in: ["COMPLETED", "CANCELLED"]
            }
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "COMPLETED": return "bg-green-100 text-green-700";
            case "CANCELLED": return "bg-red-100 text-red-700";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "COMPLETED": return "Venta Exitosa";
            case "CANCELLED": return "Cancelado";
            default: return status;
        }
    };

    const totalRevenue = orders
        .filter((o: any) => o.status === "COMPLETED")
        .reduce((sum: number, o: any) => sum + o.total, 0);

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            {/* Header */}
            <div className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Historial de Ventas</h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Registro de ventas finalizadas y pedidos cancelados.</p>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 px-6 py-3 rounded-2xl flex items-center gap-4 w-full md:w-auto">
                    <div className="p-2 bg-green-500 text-white rounded-xl">
                        <History size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-green-700 font-bold uppercase tracking-wider">Ingresos Totales</p>
                        <p className="text-lg font-black text-green-600">${totalRevenue.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar venta por ID de pedido o cliente..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors font-medium w-full md:w-auto">
                    <Filter size={18} />
                    <span>Filtros Mensuales</span>
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
                                <th className="px-4 md:px-6 py-4 text-center">Estado Final</th>
                                <th className="px-4 md:px-6 py-4 text-center">Ticket</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-slate-700">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-gray-400 italic">No hay historial de ventas registrado aún.</td>
                                </tr>
                            ) : orders.map((order: any) => (
                                <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors group ${order.status === "CANCELLED" ? "opacity-60" : ""}`}>

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

                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <button className="p-2 text-gray-400 hover:text-primary transition-colors" title="Ver Ticket">
                                            <ExternalLink size={18} className="mx-auto" />
                                        </button>
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Mostrando {orders.length} registros</span>
                </div>
            </div>
        </div>
    );
}
