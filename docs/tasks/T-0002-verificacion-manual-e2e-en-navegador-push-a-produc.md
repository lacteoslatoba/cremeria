---
id: T-0002
titulo: Verificacion manual E2E en navegador + push a produccion (Task 9 pasos 4-5)
estado: pendiente
prioridad: media
asignado-por: cline
asignado-a: usuario
creado: 2026-09-18 20:14:18
actualizado: 2026-09-18 20:14:18
archivos: 
criterio: carrito nuevo -> checkout -> pagar en Efectivo -> cae en /direccion/<id> -> confirmar pin -> /mis-pedidos?paid=cash con direccion real guardada; en admin ese pedido ya muestra el dropdown de repartidor; luego push a main y Vercel en Ready con 200 en / y /mis-pedidos
contexto: Pasos 4 y 5 de la Task 9 del plan post-payment-address. Requiere navegador, un pedido pagado real y tu decision de desplegar. Ojo: hay que parar el dev server (PID 17752) antes de correr npm run build completo, porque prisma generate no puede renombrar el DLL con el server corriendo.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
