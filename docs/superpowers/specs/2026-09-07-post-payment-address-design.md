# Confirmar ubicación de entrega después del pago

## Problema

Hoy `Order.address` nunca refleja la ubicación real del cliente: se
llena con el string fijo `"Ubicación GPS (Actual)"` en el momento en
que se crea la orden (en `cart/page.tsx`, al hacer prefetch del
PaymentIntent, y en `checkout/page.tsx`). No existe ningún paso donde
el cliente elija o confirme dónde quiere que le llegue su pedido — así
que si compra desde un lugar distinto a su domicilio habitual (p. ej.
la casa de su mamá), no hay forma de indicarlo.

## Objetivo

Después de que el pago se confirma, mostrarle al cliente un mapa
(Leaflet + OpenStreetMap, ya integrado en el proyecto vía
`src/components/tracking/live-map.tsx` — sin costo, sin API key)
centrado en su GPS actual, con un pin que puede arrastrar para ajustar
el punto exacto. Al confirmar, esa ubicación queda guardada en su
orden. Imita el flujo de DiDi Food (dirección se confirma después de
pagar, no antes).

## Alcance

Dentro:
- Nueva pantalla de mapa post-pago.
- Nuevo componente `LocationPicker` (pin arrastrable, sin rastreo en
  vivo).
- Nuevo endpoint para guardar la ubicación de una orden.
- Aviso de "falta confirmar ubicación" en Mis Pedidos si el cliente
  cerró la app antes de terminar.
- Bloqueo de asignación de repartidor en el admin mientras no haya
  ubicación confirmada.
- Migración de Prisma: `Order.address` pasa a opcional, se agregan
  `addressLat`, `addressLng`, `addressConfirmedAt`.

Fuera (no se hace en este cambio):
- Cambiar a Google Maps (se descartó — se usa el mapa gratuito que ya
  existe en el proyecto).
- Buscador de direcciones por texto (solo GPS + arrastrar pin).
- Notificaciones push para recordar completar la ubicación (el aviso
  vive solo dentro de Mis Pedidos).
- Cálculo de costo de envío por distancia/zona (no existe hoy y no se
  agrega aquí).

## Diseño

### Datos (`prisma/schema.prisma`)

```prisma
model Order {
  ...
  address             String?    // antes era String obligatorio
  addressLat          Float?
  addressLng          Float?
  addressConfirmedAt  DateTime?
  ...
}
```

`addressConfirmedAt` es la señal que usa el resto del sistema (admin,
lista de "falta dirección") para saber si la orden ya tiene una
ubicación real o sigue pendiente. Una orden con `paymentStatus:
APPROVED` y `addressConfirmedAt: null` es el estado "pagado, falta
dirección".

### Flujo

```
cart/checkout (sin address) --pago exitoso--> /direccion/[orderId]
                                                     |
                                    arrastra pin, confirma
                                                     |
                                    POST /api/orders/[id]/address
                                                     |
                                              /mis-pedidos
```

Si el cliente cierra la app en `/direccion/[orderId]` sin confirmar:
la próxima vez que entre a `/mis-pedidos`, esa orden (pagada,
`addressConfirmedAt: null`) muestra una tarjeta "Falta confirmar tu
ubicación" con botón que lo manda de vuelta a `/direccion/[orderId]`.

### Componentes

- **`src/components/checkout/location-picker.tsx`** (nuevo): mapa
  Leaflet centrado en `navigator.geolocation` (si el permiso se niega,
  cae a un centro por defecto de la ciudad del negocio). Pin
  arrastrable + botón "Confirmar ubicación aquí". No comparte código
  con `live-map.tsx` más allá de la config de tiles (son componentes
  con propósitos distintos: uno elige un punto estático, el otro
  rastrea a alguien en movimiento).

- **`src/app/direccion/[orderId]/page.tsx`** (nuevo): monta
  `LocationPicker`, llama al endpoint al confirmar, redirige a
  `/mis-pedidos`. Si la orden no es del usuario logueado o ya tiene
  `addressConfirmedAt`, redirige directo a `/mis-pedidos` sin mostrar
  nada.

- **`src/app/api/orders/[id]/address/route.ts`** (nuevo): recibe
  `{lat, lng}`, intenta reverse-geocode con Nominatim (mejor esfuerzo:
  si falla o tarda, guarda igual con un texto genérico), guarda
  `address`, `addressLat`, `addressLng`, `addressConfirmedAt = now()`.

### Cambios en código existente

- `src/app/cart/page.tsx` y `src/app/checkout/page.tsx`: se quita
  `address: "Ubicación GPS (Actual)"` de la llamada que crea la orden
  — la orden se crea sin dirección.
- `src/app/checkout/page.tsx`: tras `paymentStatus: APPROVED`,
  redirige a `/direccion/[orderId]` en vez de `/mis-pedidos`.
- `src/app/mis-pedidos/page.tsx`: agrega la tarjeta de aviso descrita
  arriba para órdenes pagadas sin `addressConfirmedAt`.
- `src/app/admin/page.tsx` (control de asignación de repartidor):
  deshabilita el control de asignación con texto "Falta dirección"
  mientras `addressConfirmedAt` sea null.

## Manejo de errores

- Permiso de GPS negado → mapa se muestra igual, centrado en un punto
  por defecto; el cliente ajusta el pin a mano.
- Reverse-geocode (Nominatim) falla o tarda → se guarda la ubicación
  por coordenadas de todas formas, con `address` = "Ubicación
  seleccionada en el mapa"; nunca bloquea la confirmación.
- Acceso a `/direccion/[orderId]` de una orden ajena o ya confirmada →
  redirige a `/mis-pedidos` sin mostrar el mapa.

## Pruebas

No hay suite automatizada en el proyecto; verificación manual:
1. Pagar un pedido nuevo → debe redirigir al mapa, permitir arrastrar
   el pin, y al confirmar debe verse la dirección ya puesta en Mis
   Pedidos.
2. Pagar y cerrar la app antes de confirmar → al volver a Mis Pedidos
   debe aparecer el aviso, y completarlo desde ahí debe funcionar.
3. Como admin, un pedido sin dirección confirmada no debe dejar
   asignar repartidor; en cuanto se confirma, sí debe dejar.
