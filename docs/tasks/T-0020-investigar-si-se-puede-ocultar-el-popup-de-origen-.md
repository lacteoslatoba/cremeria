---
id: T-0020
titulo: Investigar si se puede ocultar el popup de origen/sitio en la PWA Admin instalada
estado: hecho
prioridad: baja
asignado-por: claude-code
asignado-a: cline
creado: 2026-09-24 01:47:46
actualizado: 2026-09-24 01:58:35
archivos: src/app/admin/layout.tsx,public/admin-manifest.json,next.config.ts
criterio: Instalar Cremeria Admin (cremeriadelrancho.com/admin, manifest admin-manifest.json), abrir la app, dar clic en la flechita junto al nombre en la barra de titulo. Confirmar si el popup de origen (URL + nombre del sitio) se puede quitar o cambiar, y documentar el resultado (funcione o no) en el propio manifest o en docs/inbox.md.
contexto: Mike pidio ocultar ese popup por imagen de marca. Claude Code ya investigo: es el indicador nativo anti-spoofing de Chrome para PWAs instaladas (todo sitio lo tiene, no hay manifest/meta/CSS que lo desactive), pero Mike quiere que Cline le de una segunda oportunidad. Posible pista sin probar: display_override:'window-controls-overlay' en el manifest permite a la app dibujar su propia barra de titulo -- no esta confirmado si eso quita tambien el popup de origen o si Chrome lo deja accesible de otra forma por seguridad. Si tras probar sigue sin poder ocultarse, reportar eso como resultado valido (no es un fallo de investigacion, es una confirmacion).
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-24 01:58:35 — cerrada por cline

Investigado y resuelto en lo que SI se puede controlar. Causa real de lo que reporto Mike: la barra con la URL la dibuja el NAVEGADOR cuando la app instalada sale del scope de su manifest (admin-manifest.json declara scope '/admin'); al ir a Cliente/Repartidor/carrito Chrome muestra URL+titulo por anti-spoofing. Por eso en Control Panel no salia. Arreglo desplegado (commit 8fdff53): en la app instalada (display-mode standalone) dentro de /admin la nav solo muestra Control Panel y oculta el icono del carrito (src/components/layout/side-nav.tsx). Verificado con Playwright con stub de matchMedia: normal /admin = 3 portales + carrito; instalada /admin = solo Control Panel sin carrito; instalada / = 3 portales sin cambios. Mismo resultado por HTTPS contra cremeriadelrancho.com (deployment cremeria-h66uahkhh, Ready 2m, aliasado). Sobre la pista de window-controls-overlay: NO sirve y no lo active. MDN (display_override) y web.dev (Customize the window controls overlay) confirman que WCO solo reemplaza la barra de titulo por un overlay que la app debe dibujar con env(titlebar-area-*)/app-region/navigator.windowControlsOverlay, desktop-only, y no documentan forma alguna de quitar el indicador de origen (es UI de seguridad del navegador). Activar WCO ademas dejaria los controles de ventana encima del contenido: habria que rehacer topbar/sidebar a cambio de nada. Resultado: el popup de origen NO se puede ocultar; documentado en docs/inbox.md (entrada del 23/09: causa, arreglo, WCO y nota aparte de que cerrar sesion tambien sale del scope). Pendiente solo la comprobacion visual de Mike en su PC: cerrar y abrir la app instalada y confirmar que ya no aparece en Cliente/Repartidor; si pica la flechita junto al nombre estando en Control Panel, ese popup es el indicador nativo y no hay forma de quitarlo.
