# Cremería del Rancho 🧀

Tienda en línea de una cremería construida con **Next.js 16 (App Router)** + **React 19** + **TypeScript**, con **Prisma** (PostgreSQL / Supabase) como ORM e integración de pagos con **Stripe**. Incluye PWA y notificaciones SMS con **Twilio**.

## Stack

- **Framework:** Next.js 16 (`app/` router) + Turbopack
- **Frontend:** React 19, Tailwind CSS, framer-motion, lucide-react, zustand (estado)
- **Backend / ORM:** Next.js Route Handlers + Prisma (PostgreSQL)
- **Pagos:** Stripe (Payment Element embebido — el cliente no sale de la página)
- **Otros:** Twilio (SMS), next-pwa (offline), playwright (test)

## Características

- Catálogo de productos con búsqueda, categorías y ofertas especiales.
- Carrito persistente en el navegador (localStorage vía zustand).
- Checkout de tarjeta (**STRIPE**) con Payment Element embebido: el cliente nunca sale de la página.
- Webhook de Stripe con verificación de firma y confirmación del pago contra la API.
- Control de inventario: se descuenta stock al crear la orden y se restaura si el pago es rechazado; los productos sin stock se ocultan en la tienda.
- Panel de administración: productos, pedidos, ventas y clientes.
- Usuarios con roles (`CUSTOMER` / `ADMIN`) y recuperación de contraseña.

## Requisitos previos

- Node.js 18+
- Una base de datos PostgreSQL (p. ej. Supabase)
- Credenciales de Stripe y Twilio

## Configuración

Crea un `.env.local` con las siguientes variables:

```env
# Base de datos
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
# Secreto del webhook (Dashboard → Developers → Webhooks → endpoint)
STRIPE_WEBHOOK_SECRET="whsec_..."

# Twilio (opcional)
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1..."
```

> **Nunca** versiones `.env*.local` con credenciales reales.

## Puesta en marcha

```bash
# Instalar dependencias
npm install

# Generar el cliente de Prisma
npx prisma generate

# Aplicar el esquema a la base de datos
npx prisma migrate dev

# (Opcional) sembrar productos de ejemplo
npx tsx seed.ts

# Levantar el servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando            | Descripción                       |
| ------------------ | --------------------------------- |
| `npm run dev`      | Servidor de desarrollo            |
| `npm run build`    | Genera el cliente Prisma y el build de producción |
| `npm run start`    | Sirve el build de producción      |
| `npm run lint`     | Ejecuta ESLint                    |

## Estructura

```
src/
├── app/                  # Páginas y rutas (App Router)
│   ├── admin/            # Panel de administración
│   ├── api/              # Route Handlers (auth, orders, products, users, payments)
│   ├── cart/             # Carrito
│   ├── checkout/         # Pago
│   ├── login/            # Inicio de sesión
│   └── tracking/         # Seguimiento de pedidos
├── components/           # Componentes de UI (home, admin, layout, auth)
└── lib/                  # Utilidades, stores y cliente Prisma
prisma/
└── schema.prisma         # Esquema de base de datos
```

## Despliegue

Optimizado para [Vercel](https://vercel.com). Al desplegar, configura las variables de entorno del proyecto (ver sección **Configuración**).
