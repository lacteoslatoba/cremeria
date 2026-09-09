import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// En serverless (Vercel) cada función puede abrir su propia conexión con la BD.
// Sin un límite explícito, muchas instancias en paralelo pueden agotar el pool
// de PostgreSQL (Supabase Free: ~60 conexiones). Limitamos a 10 por instancia
// y configuramos pool_timeout para hacer queuing en lugar de fallar duro.
function makePrismaClient() {
    const baseUrl = process.env.DATABASE_URL ?? "";
    // Solo añadir parámetros de pool si la URL no los trae ya (evita duplicados).
    const url = baseUrl.includes("connection_limit")
        ? baseUrl
        : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}connection_limit=10&pool_timeout=20`;

    return new PrismaClient({
        datasources: { db: { url } },
        // Solo mostrar queries durante desarrollo; nunca en producción.
        log: process.env.NODE_ENV === "production" ? [] : ["query"],
    });
}

export const prisma = globalForPrisma.prisma || makePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
