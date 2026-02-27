import { prisma } from './src/lib/prisma';

async function main() {
    const products = [
        {
            name: "Queso Oaxaca Premium",
            category: "Lácteos",
            price: 120.00,
            stock: 45,
            image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&q=80&w=300"
        },
        {
            name: "Jamón de Pechuga de Pavo",
            category: "Carnes",
            price: 85.00,
            stock: 12,
            image: "https://images.unsplash.com/photo-1628268909376-e8c4dfdedeb4?auto=format&fit=crop&q=80&w=300"
        },
        {
            name: "Huevos Orgánicos (Cartón 12)",
            category: "Abarrotes",
            price: 65.00,
            stock: 0,
            image: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=300"
        },
        {
            name: "Leche Entera",
            category: "Lácteos",
            price: 25.00,
            stock: 30,
            image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=300&q=80"
        },
        {
            name: "Pan Integral Artesanal",
            category: "Panadería",
            price: 45.00,
            stock: 15,
            image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80"
        },
        {
            name: "Carne Molida Especial",
            category: "Carnes",
            price: 180.00,
            stock: 10,
            image: "https://images.unsplash.com/photo-1620088927958-85e78ec6f4ec?auto=format&fit=crop&w=300&q=80"
        }
    ];

    console.log("Seeding products...");
    for (const product of products) {
        await prisma.product.create({ data: product });
    }

    // Create some mock orders
    const createdProducts = await prisma.product.findMany();
    if (createdProducts.length > 0) {
        console.log("Seeding orders...");
        await prisma.order.create({
            data: {
                customerName: "Luis Fernández",
                address: "Av. Reforma 245, Apt 4B",
                total: 220.00,
                status: "PENDING",
                items: {
                    create: [
                        {
                            product: { connect: { id: createdProducts[0].id } },
                            quantity: 1,
                            price: createdProducts[0].price
                        },
                        {
                            product: { connect: { id: createdProducts[2].id } },
                            quantity: 2,
                            price: createdProducts[2].price
                        }
                    ]
                }
            }
        });
    }

    console.log("Database seeded correctly.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
