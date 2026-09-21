---
id: T-0011
titulo: Buscar por telefono en el panel de Clientes dice que no existe un cliente que si esta en la lista
estado: hecho
prioridad: alta
asignado-por: usuario
asignado-a: cline
creado: 2026-09-21 14:15:08
actualizado: 2026-09-21 14:15:14
archivos: src/lib/busqueda.ts,src/components/admin/admin-sections.tsx,src/app/admin/page.tsx
criterio: escribir 613 111 4801 en el buscador de Clientes encuentra al cliente Mike que ya estaba en la lista, y npm run check PASA
contexto: Reporte del usuario: en /admin, pestana Clientes, el cliente 613 111 4801 no aparece al buscarlo aunque si esta en la lista. Causa: el filtro solo comparaba nombre y correo, y el telefono se guarda con guiones. Detalle en docs/inbox.md.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-21 14:15:14 — cerrada por cline

Causa raiz: el filtro de Clientes solo comparaba nombre y correo, y el telefono se guarda con guiones 613-111-4801 mientras se escribe con espacios 613 111 4801; con el filtro vacio la tabla avisaba 'No hay clientes registrados aun', que es lo que se veia como 'no existe'. Fix: nuevo helper src/lib/busqueda.ts con busqueda tolerante al formato -texto literal y, si hay 3 o mas digitos, comparacion por digitos incluida la lada +52-, aplicado en Clientes -nombre, correo, usuario y telefono- y en Pedidos -folio, cliente, direccion y telefono del cliente, que ahora si viaja en la consulta-. El mensaje de tabla vacia ya distingue 'no hay clientes registrados' de 'ninguno coincide con X'. Evidencia: 13 de 13 casos en prueba temporal del helper con el dato real de Mike -613 111 4801, 6131114801, +52 613 111 4801, 4801 y mike dan match; 999 y juan no-; npm run check PASA; el dev server compila el cambio por hot-reload y responde 200 en /admin.
