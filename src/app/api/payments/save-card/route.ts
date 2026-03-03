import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/payments/save-card
// Saves a card to Mercado Pago as a Customer card and stores reference in DB
export async function POST(request: Request) {
    try {
        const { userId, token, lastFour, cardBrand, expirationMonth, expirationYear, holderName, payerEmail } = await request.json();

        if (!userId || userId === "guest") {
            return NextResponse.json({ error: "Debes iniciar sesión para guardar tarjetas" }, { status: 401 });
        }

        const accessToken = process.env.MP_ACCESS_TOKEN!;

        // Step 1: Get or create MP customer for this user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        let mpCustomerId = user?.mpCustomerId;

        if (!mpCustomerId) {
            // Create MP customer
            const customerRes = await fetch("https://api.mercadopago.com/v1/customers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ email: payerEmail || `${userId}@cremeria.local` }),
            });
            const customerData = await customerRes.json();
            if (!customerRes.ok) {
                console.error("[MP SaveCard] Error creando customer:", customerData);
                return NextResponse.json({ error: "No se pudo crear el perfil de pago" }, { status: 500 });
            }
            mpCustomerId = customerData.id;

            // Save MP customer ID to our DB
            await prisma.user.update({
                where: { id: userId },
                data: { mpCustomerId },
            });
        }

        // Step 2: Attach card token to customer
        const cardRes = await fetch(`https://api.mercadopago.com/v1/customers/${mpCustomerId}/cards`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ token }),
        });
        const cardData = await cardRes.json();
        console.log("[MP SaveCard] Resultado:", JSON.stringify(cardData));

        if (!cardRes.ok) {
            return NextResponse.json({ error: "No se pudo guardar la tarjeta en Mercado Pago" }, { status: 500 });
        }

        // Normaliza debvisa → visa, debmaster → master, etc.
        const normalizeMethodId = (id: string) => {
            const map: Record<string, string> = {
                debvisa: "visa", debmaster: "master",
                debcabal: "cabal", debnaranja: "naranja",
            };
            return map[id?.toLowerCase()] ?? id?.toLowerCase() ?? "visa";
        };

        // Step 3: Save card reference to our DB
        // Prefer MP's own data (from cardData) over what the client sent
        const rawBrand = cardData.payment_method?.id || cardBrand || "visa";
        await prisma.savedCard.create({
            data: {
                userId,
                mpCustomerId: mpCustomerId!,
                mpCardId: cardData.id,
                lastFour: cardData.last_four_digits || lastFour || "****",
                cardBrand: normalizeMethodId(rawBrand),
                expirationMonth: cardData.expiration_month?.toString() || expirationMonth || "??",
                expirationYear: cardData.expiration_year?.toString() || expirationYear || "??",
                holderName: cardData.cardholder?.name || holderName || "Titular",
            }
        });

        return NextResponse.json({ success: true, mpCardId: cardData.id });
    } catch (error: any) {
        console.error("[MP SaveCard] Error:", error?.message);
        return NextResponse.json({ error: error?.message || "Error al guardar la tarjeta" }, { status: 500 });
    }
}

// GET /api/payments/save-card?userId=xxx
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId || userId === "guest") {
            return NextResponse.json([]);
        }

        const cards = await prisma.savedCard.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(cards);
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}

// DELETE /api/payments/save-card?cardId=xxx
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const cardId = searchParams.get("cardId");
        if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

        const card = await prisma.savedCard.findUnique({ where: { id: cardId } });
        if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

        // Delete from MP
        const accessToken = process.env.MP_ACCESS_TOKEN!;
        await fetch(`https://api.mercadopago.com/v1/customers/${card.mpCustomerId}/cards/${card.mpCardId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${accessToken}` },
        });

        // Delete from our DB
        await prisma.savedCard.delete({ where: { id: cardId } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
