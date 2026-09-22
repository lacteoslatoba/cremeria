---
id: T-0015
titulo: Probar con una cuenta real de repartidor que el login sale directo en /driver y desplegar
estado: pendiente
prioridad: media
asignado-por: cline
asignado-a: usuario
creado: 2026-09-22 20:11:33
actualizado: 2026-09-22 20:11:33
archivos: src/app/driver/page.tsx,src/components/auth/driver-login-form.tsx
criterio: Abrir /driver en el celular sin sesion: el formulario de repartidor aparece de entrada (sin picar nada), entrar con la cuenta real y ver los pedidos; despues desplegar a produccion
contexto: Cambio del 2026-09-22: /driver ya no muestra el cartel con boton Iniciar sesion, pinta el login ahi mismo (ver docs/inbox.md). Verificado con Playwright local; falta credencial real, celular y deploy.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
