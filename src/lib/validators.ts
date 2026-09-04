// ── Validación de entrada ligera (sin dependencias) ──
// Sustituye la toma a ciegas de campos del body (body.price, body.stock, ...)
// por lecturas tipadas y acotadas. Cada validador devuelve un objeto con los
// campos ya limpios o lanza un HttpError con mensaje claro.

import { HttpError } from "@/lib/http";

export const ALLOWED_ROLES = ["CUSTOMER", "DELIVERY", "ADMIN"] as const;
export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const PAYMENT_METHODS = ["CASH", "STRIPE"] as const;
export const PAYMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

const text = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

const int = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v) && Number.isInteger(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isInteger(Number(v))) return Number(v);
    return undefined;
};

/** Valida el precio: número >= 0, máx 2 decimales. */
const money = (v: unknown): number | undefined => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n) || n < 0) return undefined;
    const cents = Math.round(n * 100);
    if (Math.abs(cents - n * 100) > 1e-6) return undefined; // más de 2 decimales
    return cents / 100;
};

function oneOf<T extends readonly string[]>(arr: T, v: unknown, label = "valor"): T[number] | undefined {
    return typeof v === "string" && (arr as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

export type ProductInput = {
    name: string;
    category: string;
    description?: string | null;
    price: number;
    stock: number;
    image?: string | null;
    status: (typeof PRODUCT_STATUSES)[number];
};

/** Párselo de un producto (POST / PUT). */
export function parseProduct(body: Record<string, unknown>): ProductInput {
    const name = text(body.name);
    const category = text(body.category);
    const price = money(body.price);
    const stock = int(body.stock);
    if (!name) throw new HttpError("El nombre del producto es requerido", 400);
    if (!category) throw new HttpError("La categoría es requerida", 400);
    if (price === undefined) throw new HttpError("Precio inválido", 400);
    if (stock === undefined || stock < 0) throw new HttpError("Stock inválido (debe ser número entero ≥ 0)", 400);
    return {
        name,
        category,
        description: text(body.description) ?? null,
        price,
        stock,
        image: text(body.image) ?? null,
        status: (oneOf(PRODUCT_STATUSES, body.status, "status") ?? "ACTIVE") as ProductInput["status"],
    };
}
