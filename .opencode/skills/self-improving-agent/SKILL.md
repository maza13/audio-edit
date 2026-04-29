---
name: self-improving-agent
description: >
  Captures corrections, failures, knowledge gaps, reusable patterns, and feature
  requests as durable improvement records for OpenCode sessions. Trigger: use
  when an operation fails, the user corrects the agent, a recurring mistake is
  detected, a missing capability is requested, or a non-obvious learning should
  be preserved for future agents.
license: MIT-0
compatibility: >
  Designed for OpenCode workspaces. Uses project-local `.learnings/` markdown
  files and, when available, Engram memory tools for durable project memory.
metadata:
  author: CCA Team
  version: "1.0"
  adapted_from: https://clawhub.ai/pskoett/self-improving-agent
---

# Self-Improving Agent

Skill para capturar aprendizajes operativos en OpenCode sin depender de hooks de
OpenClaw ni de runtime externo. Su función es convertir errores, correcciones y
descubrimientos en memoria accionable.

## When to Use

- Cuando un comando, tool, plugin o integración falla de forma inesperada.
- Cuando el usuario corrige una interpretación, dato, procedimiento o alcance.
- Cuando se descubre que conocimiento previo estaba incompleto u obsoleto.
- Cuando aparece un patrón recurrente que debería prevenirse en futuras sesiones.
- Cuando el usuario pide una capacidad que no existe todavía.
- Cuando una solución no obvia debería promoverse a memoria del proyecto.

## Do Not Use

- No registres ruido trivial ni cada paso rutinario.
- No guardes secretos, tokens, claves, variables de entorno ni salidas completas
  que puedan contener datos sensibles.
- No declares una mejora como resuelta sin evidencia observable.
- No sustituyas el protocolo de Engram del agente primario; esta skill lo
  complementa con bitácoras locales.

## Storage Targets

Por defecto usa archivos locales del proyecto:

```text
.learnings/
├── LEARNINGS.md          # correcciones, insights, knowledge gaps, best practices
├── ERRORS.md             # fallos de comandos, tools, plugins e integraciones
└── FEATURE_REQUESTS.md   # capacidades pedidas por el usuario
```

Si Engram está disponible, guarda además los aprendizajes importantes con
`engram_mem_save` usando scope `project`.

## First-Use Initialization

Antes de registrar, verifica que exista `.learnings/`. Si falta, créala con los
tres archivos base. Nunca sobrescribas archivos existentes.

Contenido inicial recomendado:

```markdown
# Learnings

Corrections, insights, knowledge gaps, and best practices captured during work.

---
```

```markdown
# Errors

Command, tool, plugin, and integration failures captured during work.

---
```

```markdown
# Feature Requests

User-requested capabilities and workflow improvements.

---
```

## Core Workflow

1. **Clasifica el evento**
   - Error operativo → `.learnings/ERRORS.md`.
   - Corrección del usuario → `.learnings/LEARNINGS.md` con categoría `correction`.
   - Conocimiento incompleto u obsoleto → `.learnings/LEARNINGS.md` con categoría `knowledge_gap`.
   - Mejor práctica o patrón preventivo → `.learnings/LEARNINGS.md` con categoría `best_practice`.
   - Capacidad faltante → `.learnings/FEATURE_REQUESTS.md`.

2. **Registra inmediatamente**
   - Captura el contexto mientras está fresco.
   - Resume, no pegues transcripciones completas.
   - Redacta datos sensibles.
   - Incluye archivos relacionados solo si son relevantes.

3. **Deduplica antes de crear ruido**
   - Si hay una entrada similar, agrega `See Also` o actualiza recurrencia.
   - Eleva prioridad si el mismo problema reaparece.

4. **Promueve lo importante**
   - Si el aprendizaje aplica a futuras sesiones, guárdalo en Engram.
   - Si aplica a agentes o workflows, considera actualizar `AGENTS.md` o una skill.
   - Si es una convención del proyecto, considera documentación permanente.

5. **Cierra el ciclo**
   - Cuando el problema se arregle, cambia `Status` a `resolved` o `promoted`.
   - Agrega evidencia: commit, archivo modificado, comando verificado o decisión del usuario.

## Entry Format

Usa las plantillas de `assets/entry-templates.md` para mantener consistencia.

ID recomendado:

```text
LRN-YYYYMMDD-XXX
ERR-YYYYMMDD-XXX
FEAT-YYYYMMDD-XXX
```

`XXX` puede ser secuencial si ya existe el archivo, o un sufijo corto único.

## Engram Promotion Rule

Promueve a Engram cuando se cumpla cualquiera:

- Corrige una suposición futura del agente.
- Documenta una decisión de arquitectura, configuración o workflow.
- Evita una repetición probable.
- El usuario lo pide explícitamente.
- El aprendizaje afecta múltiples archivos, sesiones o agentes.

Formato Engram recomendado:

```text
**What**: Qué se aprendió o cambió.
**Why**: Qué lo motivó.
**Where**: Archivos, herramientas o área afectada.
**Learned**: Gotchas, prevención o regla futura.
```

## Critical Patterns

- **Corrección del usuario = aprendizaje**: si el usuario corrige el mismo tipo
  de desvío, registra una regla preventiva concreta.
- **Error sin RCA no mejora nada**: un error útil debe incluir intento, resultado,
  causa probable y próximo intento.
- **Memoria local vs Engram**: `.learnings/` sirve para bitácora granular;
  Engram sirve para aprendizajes durables que deben sobrevivir sesiones.
- **Privacidad primero**: guarda resúmenes sanitizados, no datos crudos.
- **Promoción agresiva pero precisa**: una regla corta y accionable vale más que
  una crónica extensa.

## Output Contract

Cuando uses esta skill, informa brevemente:

```text
Registro creado:
- Tipo: <learning | error | feature_request>
- ID: <ID>
- Destino: <archivo local y/o Engram>
- Motivo: <por qué importa>
- Próximo paso: <resolver | promover | revisar luego>
```
