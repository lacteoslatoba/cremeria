---
id: T-0024
titulo: Decidir prefijo __Host- en la cookie de sesion y la duracion o revocacion de sesiones
estado: pendiente
prioridad: media
asignado-por: cline
asignado-a: usuario
creado: 2026-09-26 01:39:03
actualizado: 2026-09-26 01:39:03
archivos: src/lib/auth.ts
criterio: Decision escrita en docs/seguridad.md seccion 4 con el porque; si se aplica, el login y todo readSession siguen funcionando (suite e2e en verde)
contexto: docs/seguridad.md seccion 4: hoy logout no revoca el JWT (7 dias) y la cookie puede ser escrita por un subdominio
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
