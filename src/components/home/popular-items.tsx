import { prisma } from "@/lib/prisma";
import { AddToCartButton } from "./add-to-cart-button";

export async function PopularItems({ categoryFilter, queryFilter }: { categoryFilter?: string, queryFilter?: string }) {
    const products = await prisma.product.findMany({
        where: {
            status: "ACTIVE",
            stock: { gt: 0 },
            ...(categoryFilter ? { category: categoryFilter } : {}),
            ...(queryFilter ? { name: { contains: queryFilter, mode: "insensitive" } as any } : {}),
        },
        take: 40,
    });

    return (
        <div className="mt-6 pb-28 md:pb-10 px-4 md:px-8 relative z-10">
            <h2 className="text-xl font-bold text-foreground mb-4">
                {queryFilter ? `Resultados para "${queryFilter}"` : categoryFilter ? `Productos en ${categoryFilter}` : "Populares"}
            </h2>

            {products.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No hay productos disponibles por ahora.</p>
            ) : (
                /* Mobile: flex column / Desktop: 3-4 column grid via CSS class */
                <div className="flex flex-col gap-4 md:grid md:grid-cols-3 xl:grid-cols-4 md:gap-5">
                    {products.map((item: any) => (
                        <div key={item.id}
                            className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm md:flex-col md:items-start md:p-4 md:gap-3 hover:border-white/20 transition-all">
                            <img
                                src={item.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300"}
                                alt={item.name}
                                className="w-20 h-20 md:w-full md:h-44 rounded-xl object-cover shadow-inner bg-gray-800 shrink-0"
                            />
                            <div className="flex-1 flex flex-col justify-center md:w-full">
                                <h3 className="font-semibold text-[15px] leading-tight text-foreground line-clamp-2">
                                    {item.name}
                                </h3>
                                {item.description && (
                                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1 hidden md:block">{item.description}</p>
                                )}
                                <p className="text-primary font-bold mt-1 text-sm">${item.price.toFixed(2)}</p>
                            </div>
                            <div className="md:w-full">
                                <AddToCartButton product={item} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
