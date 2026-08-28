import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const orders = await prisma.order.findMany({
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const items = body.items || [];

        // paymentMethod: CASH | CARD
        // mpPaymentId: MP payment ID (only for card payments)
        // mpPaymentStatus: approved | in_process | rejected (from MP)
        const paymentMethod = body.paymentMethod || "CASH";
        const mpPaymentId = body.mpPaymentId || null;
        const mpPaymentStatus = body.mpPaymentStatus || null;

        // Determine paymentStatus to store
        let paymentStatus = "APPROVED"; // cash is always "approved" immediately
        if (paymentMethod === "CARD") {
            if (mpPaymentStatus === "approved") paymentStatus = "APPROVED";
            else if (mpPaymentStatus === "rejected" || mpPaymentStatus === "cancelled") paymentStatus = "REJECTED";
            else paymentStatus = "PENDING"; // in_process, pending → waiting for webhook
        }

        // ── Validar stock disponible antes de crear la orden ──
        for (const item of items) {
            const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, stock: true, status: true },
            });

            if (!product) {
                return NextResponse.json(
                    { error: `El producto ${item.productId} ya no existe` },
                    { status: 400 }
                );
            }
            if (product.status !== "ACTIVE" || product.stock < item.quantity) {
                return NextResponse.json(
                    { error: `No hay suficiente stock para "${item.name || item.productId}"` },
                    { status: 409 }
                );
            }
        }

        const order = await prisma.$transaction(async (tx: any) => {
            const newOrder = await tx.order.create({
                data: {
                    customerName: body.customerName,
                    address: body.address,
                    total: body.total,
                    status: "PENDING",
                    paymentMethod,
                    mpPaymentId,
                    paymentStatus,
                    ...(body.userId ? { user: { connect: { id: body.userId } } } : {}),
                    items: {
                        create: items.map((item: any) => ({
                            product: { connect: { id: item.productId } },
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                },
                include: { items: true }
            });

            // Deduct inventory only immediately if payment will not be rejected.
            // For CARD payments still "in_process"/PENDING we reserve the stock,
            // and the webhook restores it if the payment is later rejected.
            if (paymentStatus !== "REJECTED") {
                for (const item of items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } },
                    });
                }
            }

            return newOrder;
        });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
}
