---
name: memory-dream-cycle
description: >
  Runs an OpenCode memory "dream" cycle that scans raw learnings and ontology,
  consolidates recurring themes, and proposes safe promotions into Engram,
  ontology, AGENTS.md, TOOLS.md, skills, or project docs. Trigger: use when the
  user asks for memory consolidation, a sleep/dream cycle, review of learnings,
  deduplication, promotion of lessons, or OpenClaw-like memory behavior.
license: MIT-0
compatibility: >
  Designed for OpenCode workspaces. Reads `.learnings/` and
  `memory/ontology/graph.jsonl`. Writes only under `memory/dreams/` when
  explicitly run with `--apply`.
metadata:
  author: CCA Team
  version: "1.0"
---

# Memory Dream Cycle

Skill para simular en OpenCode un ciclo de “sueño” parecido al comportamiento de
memoria de OpenClaw: revisar recuerdos crudos, detectar patrones, consolidar
aprendizajes y proponer promociones seguras.

## When to Use

- Cuando el usuario pida un “sueño”, “dream cycle” o consolidación de memoria.
- Cuando haya muchas entradas en `.learnings/` y haga falta deduplicarlas.
- Cuando se quiera convertir errores o correcciones recurrentes en reglas.
- Cuando se quiera revisar qué debe promoverse a Engram, ontología, docs o skills.
- Cuando una sesión larga dejó aprendizajes y hay que cerrar el ciclo.

## Do Not Use

- No lo uses para capturar un aprendizaje puntual: usa `self-improving-agent`.
- No lo uses para crear entidades manuales: usa `ontology`.
- No edites `AGENTS.md`, `TOOLS.md` o skills automáticamente desde el sueño.
- No promociones secretos, credenciales, transcripciones crudas ni outputs completos.

## Memory Architecture

- `self-improving-agent` captura memoria cruda.
- `ontology` estructura entidades y relaciones consultables.
- `memory-dream-cycle` consolida, deduplica y propone promociones.

Flujo recomendado:

```text
experience -> self-improving-agent -> .learnings/
structured facts -> ontology -> memory/ontology/graph.jsonl
sleep review -> memory-dream-cycle -> memory/dreams/ + promotion plan
primary agent review -> Engram/docs/skills updates
```

## Executable CLI

```bash
python .opencode/skills/memory-dream-cycle/scripts/dream.py <command>
```

Comandos:

```bash
# Inventario crudo de .learnings y ontology
python .opencode/skills/memory-dream-cycle/scripts/dream.py scan

# Temas recurrentes, salud de memoria y acciones siguientes
python .opencode/skills/memory-dream-cycle/scripts/dream.py consolidate

# Candidatos de promoción, sin escribir por defecto
python .opencode/skills/memory-dream-cycle/scripts/dream.py promote

# Ciclo completo en dry-run
python .opencode/skills/memory-dream-cycle/scripts/dream.py run

# Ciclo completo escribiendo solo reportes/planes bajo memory/dreams/
python .opencode/skills/memory-dream-cycle/scripts/dream.py --apply run
```

Para probar sin tocar el proyecto real:

```bash
python .opencode/skills/memory-dream-cycle/scripts/dream.py --root /tmp/workspace run
```

## Core Workflow

1. **Scan**
   - Lee `.learnings/LEARNINGS.md`, `.learnings/ERRORS.md`, `.learnings/FEATURE_REQUESTS.md`.
   - Lee `memory/ontology/graph.jsonl` si existe.
   - Reporta conteos, estados, prioridades, áreas y errores de parseo.

2. **Consolidate**
   - Extrae keywords y temas recurrentes.
   - Agrupa entradas relacionadas.
   - Identifica pendientes, alta prioridad y salud de la ontología.

3. **Promote candidates**
   - Sugiere destino: Engram, ontology, `AGENTS.md`, `TOOLS.md`, skill relevante o docs.
   - Produce texto sugerido, no aplica cambios destructivos.

4. **Review**
   - El agente primario revisa el plan.
   - Solo después de aprobación explícita se aplican promociones reales fuera de `memory/dreams/`.

5. **Apply safely**
   - `--apply` solo escribe:
     - `memory/dreams/reports/dream-report-*.json`
     - `memory/dreams/promotion-plan.md`

## Promotion Rules

Usa `references/promotion-rules.md` para decidir destino y umbral de promoción.

Resumen:

- Engram: aprendizaje durable entre sesiones.
- Ontology: entidades/relaciones consultables.
- `AGENTS.md`: coordinación, delegación, verificación o estilo operativo.
- `TOOLS.md`: gotchas de herramientas, plugins o runtime.
- Skill `SKILL.md`: cambios de triggering o workflow de una skill.
- Docs: convenciones humanas o arquitectura del proyecto.

## Safety Rules

- Default = dry-run.
- `--apply` no edita instrucciones operativas directamente.
- Toda promoción real requiere revisión humana o instrucción explícita posterior.
- No guardar secretos ni datos crudos sensibles.
- Mantener trazabilidad hacia IDs de `.learnings/`.

## Output Contract

Cuando uses esta skill, reporta:

```text
Memory dream cycle:
- Mode: <scan | consolidate | promote | run>
- Dry-run: <true | false>
- Inputs: <.learnings, ontology, Engram if manually included>
- Themes: <top recurring themes>
- Promotion candidates: <count + targets>
- Written files: <none | memory/dreams/...>
- Next action: <review/apply/promote manually>
```
