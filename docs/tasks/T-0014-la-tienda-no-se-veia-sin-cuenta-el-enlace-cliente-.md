---
id: T-0014
titulo: La tienda no se veia sin cuenta: el enlace Cliente del menu rebotaba al login
estado: hecho
prioridad: alta
asignado-por: usuario
asignado-a: cline
creado: 2026-09-21 20:03:56
actualizado: 2026-09-21 20:03:57
archivos: src/components/auth/auth-guard.tsx
criterio: Playwright sin sesion: / y /terminos se ven; /cart, /checkout, /mis-pedidos y /tracking mandan a /login?portal=cliente; y el clic en Cliente del menu llega a la tienda; npm run check PASA
contexto: Decision del usuario -opcion A-: para comprar se pide cuenta, para mirar no. Desde fac9bad el AuthGuard bloqueaba cualquier ruta de cliente, asi que un visitante sin cuenta no veia el catalogo y el enlace Cliente del menu rebotaba al login en un callejon sin salida.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-21 20:03:57 — cerrada por cline

Fix: el AuthGuard ahora solo exige sesion en las rutas de compra -/cart, /checkout, /mis-pedidos, /tracking, /direccion-; la tienda y las paginas publicas quedan abiertas, asi que el link compartido y el enlace Cliente del menu funcionan. Evidencia con Playwright sin sesion contra el dev server: / publica y con catalogo visible -Hola, Invitado, buscador, categorias, ofertas, productos con precio-, /terminos publica, /cart /checkout /mis-pedidos /tracking a /login?portal=cliente, y clic en Cliente del menu llega a /; 7 de 7 casos PASA; npm run check PASA. Captura en TEMP/diag-tienda-invitado.png.
