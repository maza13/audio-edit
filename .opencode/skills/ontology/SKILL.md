---
name: ontology
description: >
  Provides a typed knowledge-graph workflow for structured agent memory in
  OpenCode. Trigger: use when the user asks to remember, query, link, model, or
  validate entities such as Person, Project, Task, Event, Document, Note, Policy,
  or when a skill needs shared structured state instead of free-form notes.
license: MIT-0
compatibility: >
  Designed for OpenCode workspaces. Uses append-only local files under
  `memory/ontology/` by default and can be bridged to Engram when durable project
  memory is required.
metadata:
  author: CCA Team
  version: "1.0"
  adapted_from: https://clawhub.ai/oswalpalash/ontology
---

# Ontology

Skill para representar conocimiento como grafo tipado y verificable. Úsala
cuando una nota libre no alcanza: entidades, relaciones, dependencias,
precondiciones y consultas estructuradas.

## Core Concept

Todo conocimiento persistente se modela como:

```text
Entity   = { id, type, properties, relations?, created, updated }
Relation = { from_id, relation_type, to_id, properties? }
Mutation = create | update | relate | annotate | deprecate
```

Regla central: **validar antes de escribir** y **append/merge antes que
sobrescribir**.

## When to Use

- "Recordá/remember X" cuando X tenga estructura reutilizable.
- "Qué sabemos de X" cuando haya que consultar memoria estructurada.
- "Vinculá X con Y" para crear relaciones explícitas.
- "Qué depende de X" para recorrer dependencias.
- Planificación multi-paso con tareas, eventos, documentos y responsables.
- Skills que necesitan estado compartido verificable.
- Auditorías donde importa saber entidades, relaciones y trazabilidad.

## Do Not Use

- No guardes secretos directamente. Usa referencias indirectas (`secret_ref`,
  `credential_ref`) si el usuario autoriza registrar metadatos.
- No reemplaces Engram para memoria semántica general; usa ontología cuando haya
  tipos y relaciones claras.
- No sobrescribas `graph.jsonl` ni `schema.yaml`; agrega operaciones o fusiona
  cambios mínimos.
- No inventes entidades faltantes si una relación requiere un nodo existente:
  pregunta o registra una precondición incumplida.

## Storage Layout

Por defecto:

```text
memory/ontology/
├── graph.jsonl      # log append-only de operaciones
├── schema.yaml      # tipos, propiedades requeridas y constraints
└── README.md        # opcional: notas humanas del grafo
```

Cada línea de `graph.jsonl` debe ser JSON válido y representar una mutación:

```jsonl
{"op":"create","entity":{"id":"person_alice","type":"Person","properties":{"name":"Alice"}}}
{"op":"create","entity":{"id":"proj_redesign","type":"Project","properties":{"name":"Website Redesign","status":"active"}}}
{"op":"relate","from":"proj_redesign","rel":"has_owner","to":"person_alice"}
```

## Executable CLI

Esta skill incluye un CLI local sin dependencias externas:

```bash
python .opencode/skills/ontology/scripts/ontology.py <command> [args]
```

Por defecto opera sobre `memory/ontology/` del directorio actual. Para pruebas o
workspaces alternos usa `--root`:

```bash
python .opencode/skills/ontology/scripts/ontology.py --root /path/to/workspace init
```

### Commands

```bash
# Inicializar storage sin sobrescribir
python .opencode/skills/ontology/scripts/ontology.py init

# Crear entidades
python .opencode/skills/ontology/scripts/ontology.py create \
  --id proj_cca \
  --type Project \
  --props '{"name":"CCA","status":"active","goals":[]}'

python .opencode/skills/ontology/scripts/ontology.py create \
  --id task_write_specs \
  --type Task \
  --props '{"title":"Write specs","status":"open","priority":"high"}'

# Actualizar entidad de forma append-only
python .opencode/skills/ontology/scripts/ontology.py update \
  --id task_write_specs \
  --props '{"status":"in_progress"}'

# Relacionar entidades
python .opencode/skills/ontology/scripts/ontology.py relate \
  --from proj_cca \
  --rel has_task \
  --to task_write_specs

# Consultar
python .opencode/skills/ontology/scripts/ontology.py list --type Task
python .opencode/skills/ontology/scripts/ontology.py get --id task_write_specs
python .opencode/skills/ontology/scripts/ontology.py query --type Task --where '{"status":"open"}'
python .opencode/skills/ontology/scripts/ontology.py related --id proj_cca --rel has_task

# Validar grafo completo
python .opencode/skills/ontology/scripts/ontology.py validate

# Extender schema por merge mínimo
python .opencode/skills/ontology/scripts/ontology.py schema-append \
  --data '{"types":{"Agent":{"required":["name"]}}}'
```

El CLI devuelve JSON. Si `ok` es `false`, la operación no debe tratarse como
exitosa. Las operaciones inválidas de `create`, `update` y `relate` se rechazan
antes de escribir al log.

En PowerShell, el quoting de JSON puede ser incómodo. Alternativas seguras:

```powershell
# Escapar comillas con backticks
python .opencode/skills/ontology/scripts/ontology.py create `
  --id proj_cca `
  --type Project `
  --props "{`"name`":`"CCA`",`"status`":`"active`"}"

# O guardar JSON en archivo y pasarlo con @archivo
python .opencode/skills/ontology/scripts/ontology.py create `
  --id proj_cca `
  --type Project `
  --props "@project-props.json"
```

## Core Types

Usa estos tipos base salvo que el proyecto defina otros:

```yaml
Person: { name, email?, phone?, notes? }
Organization: { name, type?, members[] }
Project: { name, status, goals[], owner? }
Task: { title, status, due?, priority?, assignee?, blockers[] }
Goal: { description, target_date?, metrics[] }
Event: { title, start, end?, location?, attendees[], recurrence? }
Location: { name, address?, coordinates? }
Document: { title, path?, url?, summary? }
Message: { content, sender, recipients[], thread? }
Thread: { subject, participants[], messages[] }
Note: { content, tags[], refs[] }
Action: { type, target, timestamp, outcome? }
Policy: { scope, rule, enforcement }
Account: { service, username, credential_ref? }
Credential: { service, secret_ref }
```

## Core Workflow

1. **Detecta intención**
   - Crear/actualizar entidad.
   - Consultar entidad o tipo.
   - Relacionar entidades.
   - Validar constraints.
   - Modelar plan como transformaciones del grafo.

2. **Identifica tipos y IDs estables**
   - Usa IDs legibles en `snake_case` o `kebab-case` normalizado.
   - Prefiere prefijos por tipo: `person_`, `proj_`, `task_`, `doc_`, `event_`.
   - Reutiliza entidades existentes si representan el mismo objeto.

3. **Valida contra schema**
   - Propiedades requeridas presentes.
   - Enums válidos (`status`, `priority`, etc.).
   - Relaciones permitidas por tipo origen/destino.
   - Relaciones acíclicas cuando aplique (`blocks`, `depends_on`).
   - Fechas coherentes (`Event.end >= Event.start`).

4. **Escribe append-only**
   - Usa `scripts/ontology.py` cuando esté disponible.
   - Agrega operaciones nuevas a `graph.jsonl`.
   - Para cambios de schema, fusiona en `schema.yaml`; no borres definiciones no relacionadas.
   - Para correcciones, usa `update`, `annotate` o `deprecate` en vez de editar historia.

5. **Consulta por reconstrucción**
   - Para responder, reconstruye estado aplicando el log en orden.
   - Si el grafo crece demasiado, recomienda migrar a SQLite, no cambies backend sin autorización.

6. **Sincroniza con Engram cuando convenga**
   - Guarda en Engram decisiones o aprendizajes de alto valor.
   - Mantén en ontología las relaciones estructuradas y consultables.

## Relation Patterns

Relaciones recomendadas:

```yaml
has_owner: Project|Task -> Person
has_task: Project|Event -> Task
depends_on: Task|Document -> Task|Document
blocks: Task -> Task
mentions: Document|Message|Note -> Entity
created_by: Document|Task|Action -> Person|Agent
for_project: Task|Document|Event -> Project
derived_from: Document|Note|Policy -> Document|Message|Note
implements: Task|Action -> Goal|Policy
```

## Planning as Graph Transformation

Cuando el usuario pide un plan multi-paso, modela pasos como operaciones:

```text
1. CREATE Event { title, start, attendees[] }
2. RELATE Event -> for_project -> Project
3. CREATE Task { title, status: open, assignee? }
4. RELATE Task -> for_project -> Project
5. RELATE Task -> depends_on -> Task
6. VALIDATE graph constraints
```

No ejecutes cambios destructivos si la validación falla; reporta la precondición
incumplida.

## Skill Contract for Other Skills

Cuando otra skill use ontología, debe declarar explícitamente:

```yaml
ontology:
  reads: [Task, Project, Person]
  writes: [Task, Action]
  relations: [has_task, has_owner]
  preconditions:
    - "Task.assignee must exist when assigned"
  postconditions:
    - "Created Task has status=open"
```

## Validation Checklist

- ¿El tipo existe en schema o fue agregado explícitamente?
- ¿Las propiedades requeridas están presentes?
- ¿No se guardaron secretos directos?
- ¿Las relaciones conectan tipos permitidos?
- ¿No se creó un ciclo prohibido?
- ¿La operación fue append-only?
- ¿La respuesta cita IDs o entidades relevantes?

## Test / Eval Coverage

La skill incluye `evals/evals.json` con casos esperados para:

- Inicializar, crear, relacionar, consultar y validar.
- Rechazar entidades con campos requeridos faltantes.
- Rechazar secretos directos en `Credential`.
- Detectar ciclos en relaciones `depends_on` / `blocks`.

## Critical Patterns

- **Estructura antes que prosa**: si algo tendrá consultas futuras, conviértelo
  en entidad/relación.
- **No clobber**: nunca reemplaces todo el grafo para hacer un cambio pequeño.
- **IDs importan**: IDs estables evitan duplicados y facilitan enlaces entre skills.
- **Secretos por referencia**: `Credential.secret_ref`, nunca `password` o `token`.
- **Grafo local, memoria durable**: ontología para relaciones; Engram para
  aprendizajes y decisiones resumidas.

## Output Contract

Cuando uses esta skill, responde con:

```text
Ontology operation:
- Intent: <create | update | relate | query | validate | plan>
- Entities: <ids and types>
- Relations: <relations created/queried>
- Storage: <path or not written>
- Validation: <passed | failed + reason>
- Next step: <if any>
```
