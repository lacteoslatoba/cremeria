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

        // items should be array of { productId, quantity, price }
        const items = body.items || [];

        // Create order and update stock in a transaction
        const order = await prisma.$transaction(async (tx: any) => {
            const newOrder = await tx.order.create({
                data: {
                    customerName: body.customerName,
                    address: body.address,
                    total: body.total,
                    status: "PENDING",
                    items: {
                        create: items.map((item: any) => ({
                            product: { connect: { id: item.productId } },
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            // Deduct inventory
            for (const item of items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });
            }

            return newOrder;
        });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
}
