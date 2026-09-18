# Claude Code — lee esto antes de actuar

Las instrucciones completas de este proyecto están en **`AGENTS.md`**, en la raíz.
**Léelo ahora** antes de proponer o hacer cambios.

Resumen de una línea: este repo lo trabajan dos agentes; tú (**Claude Code**) exploras,
decides y **asignas**, y **Cline** ejecuta. El canal es la cola sobre `docs/tasks/`:

```powershell
npm.cmd run tasks -- assign "Titulo" --prioridad alta --files "ruta/real.ts" --criterio "comprobable con un comando" --contexto "de donde sale" --by claude-code --to cline
```

Usa `npm.cmd` (no `npm`): PowerShell tiene bloqueado `npm.ps1` en este equipo.
