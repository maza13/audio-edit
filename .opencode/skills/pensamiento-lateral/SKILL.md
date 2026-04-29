---
name: pensamiento-lateral
description: >
  Protocolo de análisis estructurado para problemas bloqueantes o inexplicables.
  Activa el modo de pensamiento crítico/lateral para generar hipótesis fundamentadas
  antes de intentar soluciones.
  Trigger: "activa el pensamiento lateral", "activa pensamiento lateral", "/lateral",
  "/pensamiento-lateral", "modo lateral", "análisis lateral"
license: Apache-2.0
metadata:
  author: gentelmen-programming
  version: "1.0"
---

## Cuando Usar Esta Skill

- Cuando un bug o problema no tiene solución evidente después de varios intentos
- Cuando el agente va en círculos probando la misma cosa sin éxito
- Cuando se necesita cambiar de enfoque y ver el problema desde otro ángulo
- Cuando el usuario activa explícitamente el trigger

## Protocolo de Activación

Cuando el usuario activa este modo, el agente debe:

1. **Detener** el modo de resolución activa (no seguir probando cosas)
2. **Reconocer** que entramos en modo análisis estructurado
3. **Informar** al usuario que estamos en modo pensamiento lateral
4. **Ejecutar** las 5 fases siguientes

## Fase 1 — Evidencia Confirmada

**Pregunta**: ¿Qué sabemos con certeza que falla?

Reglas:
- Solo hechos constatables, NO suposiciones
- No intuiciones tipo "creo que es porque..."
- Incluir mensajes de error exactos si hay
- Incluir comportamiento observado real

**Template de respuesta**:
```
## Evidencia Confirmada
- [ ] Comportamiento exacto observado: ...
- [ ] Mensajes de error (si aplica): ...
- [ ] Última vez que funcionó (si se sabe): ...
- [ ] Cuándo comenzó a fallar (si se sabe): ...
```

## Fase 2 — Candidato Obvio

**Pregunta**: ¿Algo trivially simple que estamos ignorando?

Checklist:
- ¿Error tipográfico en nombres de variables/funciones/archivos?
- ¿Mayúsculas/minúsculas incorrectas (case sensitivity)?
- ¿Ruta de archivo o import mal escrito?
- ¿Configuración faltante o mal puesta?
- ¿El problema real es diferente al que creemos que estamos resolviendo?
- ¿Estamos resolviendo el síntoma y no la causa raíz?
- ¿Hay algo que dimos por sentado que no verificamos?

**Template de respuesta**:
```
## Candidato Obvio
- [ ] Verificado: ...
- [ ] Descartado: ...
- [ ] Posible pero no verificado: ...
```

## Fase 3 — Contexto y Dependencias

**Pregunta**: ¿Hay factores externos que podrían estar influyendo?

Checklist:
- ¿Dependencias externas que fallan o están caidas?
- ¿Configuraciones de entorno diferentes entre ambientes?
- ¿Estado previo del sistema (cache, sesiones, datos persistidos)?
- ¿Recursos externos (API de terceros, bases de datos, redes)?
- ¿Cambios recientes en el entorno o en las dependencias?
- ¿Límites o restricciones del sistema que estemos alcanzando?

**Template de respuesta**:
```
## Contexto y Dependencias
- [ ] Dependencia externa: ... (verificada/descartada)
- [ ] Config de entorno: ... (OK/problemática)
- [ ] Estado del sistema: ... (relevante/irrelevante)
- [ ] Recursos externos: ... (OK/fallando/desconocido)
```

## Fase 4 — Preguntas de Dominio

**Pregunta**: ¿Qué preguntas específicas del dominio o tecnología deberíamos hacernos?

El agente debe adaptarse al contexto del problema. Ejemplos:

### Si es código:
- ¿Hay algún patron conocido de error en esta tecnología?
- ¿La versión de la dependencia es compatible?
- ¿Estamos usando la API correctamente?

### Si es infraestructura:
- ¿Los permisos están bien configurados?
- ¿Hay límites de cuota o rate limiting?
- ¿La región o zona es correcta?

### Si es datos:
- ¿Los datos tienen el formato esperado?
- ¿Hay caracteres especiales o codificación problemática?
- ¿Los datos están actualizados?

**Template de respuesta**:
```
## Preguntas de Dominio
- [ ] Pregunta específica 1: ... (respondida/pendiente)
- [ ] Pregunta específica 2: ... (respondida/pendiente)
- [ ] Pregunta específica 3: ... (respondida/pendiente)
```

## Fase 5 — Hipótesis Fundamentadas

**Pregunta**: ¿Cuáles son las 2-3 hipótesis más probables?

Reglas:
- Basadas en la evidencia de las fases anteriores
- Cada hipótesis debe tener un razonamiento claro
- Ordenar de más probable a menos probable
- Incluir cómo se podría verificar cada una

**Template de respuesta**:
```
## Hipótesis Fundamentadas

### Hipótesis 1 (más probable)
**Descripción**: ...
**Razonamiento**: ...
**Cómo verificarla**: ...

### Hipótesis 2
**Descripción**: ...
**Razonamiento**: ...
**Cómo verificarla**: ...

### Hipótesis 3
**Descripción**: ...
**Razonamiento**: ...
**Cómo verificarla**: ...
```

## Cierre del Análisis

Al finalizar las 5 fases, el agente debe:

1. **Presentar** el análisis completo al usuario
2. **Solicitar** feedback o información adicional que el usuario pueda aportar
3. **Guardar** el análisis en engram (ver abajo)
4. **Ofrecer** próximos pasos posibles

## Guardado en Engram

Después de completar el análisis, guardar en engram con:

```json
{
  "title": "Análisis lateral: {breve descripción del problema}",
  "type": "analysis",
  "topic_key": "lateral-think/{dominio-o-area}",
  "content": {
    "problema": "{descripción del problema}",
    "fase1_evidencia": "{...}",
    "fase2_candidato_obvio": "{...}",
    "fase3_contexto": "{...}",
    "fase4_dominio": "{...}",
    "fase5_hipotesis": ["{hipotesis 1}", "{hipotesis 2}"],
    "resolucion": "{si se resolvió, cómo}"
  }
}
```

**Nota**: Usar `mem_save` del proyecto actual. Si el problema se resuelve, actualizar la observación con la resolución.

## Variaciones del Trigger

| Trigger | Variaciones aceptadas |
|---------|----------------------|
| `activa el pensamiento lateral` | `activa pensamiento lateral`, `modo lateral` |
| `/lateral` | `/pensamiento-lateral`, `/think-lateral` |
| `análisis lateral` | `analiza lateralmente`, `pensamiento fuera de la caja` |

## Notas Importantes

- Esta skill NO ejecuta debugging ni pruebas
- Su propósito es generar hipótesis bien fundamentadas
- El usuario decide qué camino seguir después del análisis
- Si el usuario pide continuar con debugging, cargar la skill de debugging correspondiente
