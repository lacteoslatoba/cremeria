// cache.ts — Cache de datos de alto trafico con unstable_cache (Next.js 15+).
//
// Por que: el menu de productos es la pagina mas visitada de la app. Sin cache,
// cada cliente que abre la tienda lanza un query a PostgreSQL. Con 5,000 usuarios
// concurrentes eso satura el connection pool.
//
// Como funciona:
//   - getCachedProducts()  → cache 60s, se invalida via revalidateTag("products")
//   - Cuando el admin edita/crea/elimina un producto la ruta de API llama a
//     revalidateTag("products") y el siguiente request re-ejecuta el query.
//   - En modo dev (NODE_ENV !== "production") el cache es efectivamente un no-op
//     porque Next.js no persiste la Data Cache entre requests en modo dev por defecto.

import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

/** Productos activos con stock > 0 — cacheados 60 segundos en el Data Cache. */
export const getCachedActiveProducts = unstable_cache(
    async () =>
        prisma.product.findMany({
            where: { status: "ACTIVE", stock: { gt: 0 } },
            orderBy: [{ category: "asc" }, { createdAt: "desc" }],
        }),
    ["active-products"],
    { revalidate: 60, tags: ["products"] }
);

/** Todos los productos (para el panel admin) — cache corto de 10 segundos.
 *  Se invalida con el mismo tag "products" cuando el admin hace cambios. */
export const getCachedAllProducts = unstable_cache(
    async () =>
        prisma.product.findMany({
            orderBy: { createdAt: "desc" },
        }),
    ["all-products"],
    { revalidate: 10, tags: ["products"] }
);
