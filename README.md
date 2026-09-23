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
# Remitente habilitado para WhatsApp (sin el prefijo "whatsapp:"); el
# número del sandbox de Twilio sirve para pruebas.
TWILIO_WHATSAPP_NUMBER="+1..."

# Proveedor de WhatsApp para los codigos de verificacion: "meta" o "twilio".
# Sin esta variable se usa el que tenga credenciales (Meta primero).
WHATSAPP_PROVIDER="meta"
# Meta WhatsApp Cloud API (developers.facebook.com -> caso de uso WhatsApp).
META_WHATSAPP_TOKEN="..."
META_PHONE_NUMBER_ID="..."
# Id de la WhatsApp Business Account (NO el del numero de telefono): lo pide
# `npm run whatsapp:plantilla` para crear la plantilla. Ej: "1234567890"
META_WABA_ID=""
# Plantilla de categoria "authentication" con la que se manda el codigo. Es el
# unico camino que Meta acepta para un OTP: el texto libre solo pasa dentro de la
# ventana de 24 h que abre el cliente al escribirnos, y el registro lo inicia el
# negocio. Se crea con `npm run whatsapp:plantilla`.
META_WHATSAPP_TEMPLATE=""
META_WHATSAPP_TEMPLATE_LANG="es_MX"
# "copiar" (default) manda tambien el parametro del boton "Copiar codigo";
# "ninguno" lo omite, para plantillas creadas sin boton (zero-tap).
META_WHATSAPP_TEMPLATE_BOTON="copiar"

# Con "true" el registro vuelve a fallar con 502 si no se puede entregar el
# codigo. Por defecto (false) el registro sigue y la pantalla muestra el codigo.
OTP_ESTRICTO="false"
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

| Comando                | Descripción                                             |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo                                  |
| `npm run build`        | Genera el cliente Prisma y el build de producción       |
| `npm run start`        | Sirve el build de producción                            |
| `npm run lint`         | Ejecuta ESLint                                          |
| `npm run stripe:setup` | Diagnostica/crea el webhook de Stripe (ver abajo)       |
| `npm run whatsapp:plantilla` | Crea/revisa la plantilla de autenticación con botón “Copiar código” en Meta (ver abajo) |
| `npm run whatsapp:prueba` | Manda un código de prueba por WhatsApp y muestra la respuesta cruda de Meta |
| `npm run tasks`        | Cola de tareas entre agentes (`docs/tasks/`): listar, asignar, tomar, cerrar |
| `npm run claude`       | Puente de línea de comandos hacia Claude (API o CLI headless) |
| `npm run check`        | Verifica en un solo comando lo que cambió: tsc, prisma validate y eslint; imprime PASA/FALLA |
| `npm run queue:auto`   | Carril rápido: reclama la siguiente tarea de la cola, la implementa con Claude Code headless, corre `npm run check` y solo si PASA commitea y cierra la tarea (nunca hace push) |

### Scripts de agentes (Claude Code + Cline)

Este repo lo trabajan dos agentes que se coordinan por archivos en `docs/tasks/`
en vez de por chat. Detalle completo en [`docs/agent-bridge.md`](docs/agent-bridge.md).

```bash
# Asignar una tarea a Cline
npm run tasks -- assign "Titulo" --files "ruta/real.ts" --criterio "comprobable con un comando"

# Ver la cola
npm run tasks -- list

# Verificar un cambio en un solo comando (tsc + prisma validate + eslint)
npm run check

# Avanzar la cola de forma automática (reclama, implementa, valida, commitea)
npm run queue:auto -- --yes
```

### Configurar el webhook de Stripe (automatizado)

```bash
# 1) Ver estado actual (claves y webhooks existentes)
npm run stripe:setup

# 2) Crear o alinear el endpoint del webhook
npm run stripe:setup -- --url https://TU-DOMINIO.vercel.app/api/payments/stripe/webhook
```

> El webhook requiere el secreto de firma `whsec_...`. La API de Stripe **no lo devuelve**
> para un endpoint ya creado; obténlo en el **Dashboard → Developers → Webhooks →
> “Reveal signing secret”** y pégalo en `STRIPE_WEBHOOK_SECRET` (Vercel y `.env.local`).
> El endpoint escucha los eventos `payment_intent.succeeded`, `payment_intent.payment_failed`
> y `payment_intent.canceled`.

### Códigos de verificación por WhatsApp (plantilla de autenticación)

Meta **no** acepta texto libre fuera de la ventana de 24 h que abre el cliente al
escribirnos, y un código de verificación siempre lo inicia el negocio (el cliente
apenas se está registrando). Por eso el OTP va con una **plantilla de categoría
`authentication`** con el botón **“Copiar código”**: llega la notificación, el
cliente toca el botón, el código queda en el portapapeles y lo pega en la app.

```bash
# 1) Crear (o revisar) la plantilla en la WABA. Es idempotente.
npm run whatsapp:plantilla
npm run whatsapp:plantilla -- --waba 1234567890   # si META_WABA_ID no está en .env.local
npm run whatsapp:plantilla -- --seco              # imprime el payload y no llama a Meta

# 2) Comprobar el envío real (usa la misma función que la app)
npm run whatsapp:prueba -- 6131414210
```

Tres detalles que importan al integrar esto:

- El botón se **crea** como `{"type":"otp","otp_type":"copy_code"}`, pero WhatsApp
  lo convierte en un botón **URL** cuando aprueba la plantilla. Por eso el código
  tiene que ir **dos veces** en el envío: en el cuerpo (`{{1}}`) y en el parámetro
  del botón (`index "0"`). Sin el segundo, Meta rechaza el mensaje.
- Si la plantilla se crea con `code_expiration_minutes`, Meta solo agrega el aviso
  de cuántos minutos dura el código; el cuerpo sigue llevando **un** parámetro.
- La cuenta de prueba de Meta solo entrega a los números que agregues a mano en
  su consola (error `131030`). Para clientes reales hace falta el número de
  producción y método de pago (ver `docs/tasks/T-0016`).

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
