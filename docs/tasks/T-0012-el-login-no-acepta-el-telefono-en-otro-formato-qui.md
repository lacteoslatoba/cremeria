---
id: T-0012
titulo: El login no acepta el telefono en otro formato: quien entra sin guiones no puede y parece que su cuenta no existe
estado: pendiente
prioridad: alta
asignado-por: cline
asignado-a: cline
creado: 2026-09-21 14:15:39
actualizado: 2026-09-21 14:15:39
archivos: src/app/api/auth/login/route.ts
criterio: una prueba temporal del normalizador muestra que 6131114801, 613 111 4801 y +52 613 111 4801 producen la variante 613-111-4801, y npm run check PASA
contexto: Gemelo del bug de T-0011. El registro guarda el telefono con guiones porque el input lo formatea asi, pero el campo de login NO formatea y el route compara phone: cleanId en crudo, asi que entrar sin guiones da 'Usuario o contrasena incorrectos' y se siente como que la cuenta no existe. Fix esperado: normalizar el identificador a variantes de telefono y buscar con phone in variantes, probando la contrasena contra cada candidato por si hay duplicados con otro formato.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
