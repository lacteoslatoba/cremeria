import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        // Solo mostrar queries durante desarrollo; nunca en producción
        log: process.env.NODE_ENV === "production" ? [] : ["query"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
