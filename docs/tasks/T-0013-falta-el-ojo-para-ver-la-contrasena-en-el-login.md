---
id: T-0013
titulo: Falta el ojo para ver la contrasena en el login
estado: hecho
prioridad: media
asignado-por: usuario
asignado-a: cline
creado: 2026-09-21 14:17:23
actualizado: 2026-09-21 14:17:37
archivos: src/app/login/page.tsx
criterio: Playwright headless contra /login: el campo pasa de type=password a type=text al hacer clic en Mostrar contrasena, el valor tecleado se ve, y al volver a hacer clic regresa a password; npm run check PASA
contexto: Reporte del usuario. La pagina ya tenia el ojo en las contrasenas del registro y en forgot-password, pero la del login no lo tenia, y es la que se usa a diario desde el celular.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-21 14:17:37 — cerrada por cline

Fix en src/app/login/page.tsx: estado showLoginPassword, type dinamico en el input y boton con Eye/EyeOff y aria-label Mostrar/Ocultar contrasena; pr-12 en el input para que el texto no quede debajo del icono. Causa: era el unico campo de contrasena sin ojito -el registro y forgot-password ya lo tenian- y es justo el que se usa a diario desde el celular. Evidencia: Playwright headless contra el dev server en /login -> type password antes, type text al hacer clic con el valor tecleado visible, y password otra vez al segundo clic, cero errores de pagina; capturas en TEMP/login-ojo-visible.png y TEMP/login-ojo-oculto.png; npm run check PASA. No toque los archivos en curso de la otra sesion.
