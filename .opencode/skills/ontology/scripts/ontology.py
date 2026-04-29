#!/usr/bin/env python3
"""Append-only ontology CLI for OpenCode skills.

Storage defaults to memory/ontology under the current working directory:
- graph.jsonl: append-only operation log
- schema.yaml: JSON-compatible schema document; YAML extension is kept for skill UX

This script intentionally uses only Python's standard library.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple


DEFAULT_SCHEMA: Dict[str, Any] = {
    "types": {
        "Person": {"required": ["name"], "forbidden_properties": ["password", "secret", "token"]},
        "Organization": {"required": ["name"]},
        "Project": {
            "required": ["name", "status"],
            "status_enum": ["proposed", "active", "paused", "completed", "archived"],
        },
        "Task": {
            "required": ["title", "status"],
            "status_enum": ["open", "in_progress", "blocked", "done", "cancelled"],
            "priority_enum": ["low", "medium", "high", "critical"],
        },
        "Goal": {"required": ["description"]},
        "Event": {"required": ["title", "start"], "validate": ["end >= start if end exists"]},
        "Location": {"required": ["name"]},
        "Document": {"required": ["title"]},
        "Message": {"required": ["content"]},
        "Thread": {"required": ["subject"]},
        "Note": {"required": ["content"]},
        "Action": {"required": ["type", "target", "timestamp"]},
        "Policy": {"required": ["scope", "rule", "enforcement"]},
        "Account": {
            "required": ["service", "username"],
            "forbidden_properties": ["password", "secret", "token"],
        },
        "Credential": {
            "required": ["service", "secret_ref"],
            "forbidden_properties": ["password", "secret", "token"],
        },
    },
    "relations": {
        "has_owner": {"from_types": ["Project", "Task"], "to_types": ["Person"], "cardinality": "many_to_one"},
        "has_task": {"from_types": ["Project", "Event"], "to_types": ["Task"], "cardinality": "one_to_many"},
        "for_project": {
            "from_types": ["Task", "Document", "Event", "Note", "Action"],
            "to_types": ["Project"],
            "cardinality": "many_to_one",
        },
        "depends_on": {"from_types": ["Task", "Document"], "to_types": ["Task", "Document"], "acyclic": True},
        "blocks": {"from_types": ["Task"], "to_types": ["Task"], "acyclic": True},
        "mentions": {
            "from_types": ["Document", "Message", "Note"],
            "to_types": ["Person", "Project", "Task", "Goal", "Event", "Document", "Note", "Policy"],
        },
        "derived_from": {"from_types": ["Document", "Note", "Policy"], "to_types": ["Document", "Message", "Note"]},
        "created_by": {"from_types": ["Document", "Task", "Action"], "to_types": ["Person"]},
        "implements": {"from_types": ["Task", "Action"], "to_types": ["Goal", "Policy"]},
    },
}


SECRET_KEYS = {"password", "secret", "token", "api_key", "private_key", "access_token", "refresh_token"}


class OntologyError(Exception):
    pass


@dataclass
class Store:
    root: Path

    @property
    def ontology_dir(self) -> Path:
        return self.root / "memory" / "ontology"

    @property
    def graph_path(self) -> Path:
        return self.ontology_dir / "graph.jsonl"

    @property
    def schema_path(self) -> Path:
        return self.ontology_dir / "schema.yaml"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def emit(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True))


def parse_json_object(raw: str, label: str) -> Dict[str, Any]:
    if raw.startswith("@"):
        path = Path(raw[1:]).expanduser()
        try:
            raw = path.read_text(encoding="utf-8")
        except OSError as exc:
            raise OntologyError(f"{label} file cannot be read: {path}: {exc}") from exc
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise OntologyError(f"{label} must be valid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise OntologyError(f"{label} must be a JSON object")
    return value


def load_schema(store: Store) -> Dict[str, Any]:
    if not store.schema_path.exists():
        return DEFAULT_SCHEMA
    try:
        text = store.schema_path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise OntologyError(f"Cannot read schema: {exc}") from exc
    if not text:
        return DEFAULT_SCHEMA
    try:
        schema = json.loads(text)
    except json.JSONDecodeError as exc:
        raise OntologyError(
            f"schema.yaml must contain JSON-compatible schema for this dependency-free CLI: {exc}"
        ) from exc
    if not isinstance(schema, dict):
        raise OntologyError("schema root must be an object")
    schema.setdefault("types", {})
    schema.setdefault("relations", {})
    return schema


def write_default_schema_if_missing(store: Store) -> bool:
    if store.schema_path.exists():
        return False
    store.schema_path.write_text(json.dumps(DEFAULT_SCHEMA, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return True


def init_store(store: Store) -> Dict[str, Any]:
    store.ontology_dir.mkdir(parents=True, exist_ok=True)
    created_graph = False
    if not store.graph_path.exists():
        store.graph_path.write_text("", encoding="utf-8")
        created_graph = True
    created_schema = write_default_schema_if_missing(store)
    return {
        "ok": True,
        "ontology_dir": str(store.ontology_dir),
        "graph": str(store.graph_path),
        "schema": str(store.schema_path),
        "created": {"graph": created_graph, "schema": created_schema},
    }


def read_ops(store: Store) -> List[Dict[str, Any]]:
    if not store.graph_path.exists():
        return []
    ops: List[Dict[str, Any]] = []
    for line_no, line in enumerate(store.graph_path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            value = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise OntologyError(f"Invalid JSONL at {store.graph_path}:{line_no}: {exc}") from exc
        if not isinstance(value, dict):
            raise OntologyError(f"Invalid operation at {store.graph_path}:{line_no}: must be object")
        value.setdefault("_line", line_no)
        ops.append(value)
    return ops


def append_op(store: Store, op: Dict[str, Any]) -> None:
    store.ontology_dir.mkdir(parents=True, exist_ok=True)
    if not store.graph_path.exists():
        store.graph_path.write_text("", encoding="utf-8")
    op.setdefault("timestamp", now_iso())
    with store.graph_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(op, ensure_ascii=False, sort_keys=True) + "\n")


def reconstruct(ops: Iterable[Dict[str, Any]]) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    entities: Dict[str, Dict[str, Any]] = {}
    relations: List[Dict[str, Any]] = []
    annotations: List[Dict[str, Any]] = []

    for op in ops:
        kind = op.get("op")
        if kind == "create":
            entity = dict(op.get("entity") or {})
            entity_id = entity.get("id")
            if not entity_id:
                continue
            entity.setdefault("properties", {})
            entity["created"] = op.get("timestamp", entity.get("created"))
            entity["updated"] = op.get("timestamp", entity.get("updated"))
            entity["deprecated"] = False
            entities[entity_id] = entity
        elif kind == "update":
            entity_id = op.get("id")
            if entity_id in entities:
                entities[entity_id].setdefault("properties", {}).update(op.get("properties") or {})
                entities[entity_id]["updated"] = op.get("timestamp")
        elif kind == "relate":
            rel = {"from": op.get("from"), "rel": op.get("rel"), "to": op.get("to"), "properties": op.get("properties") or {}}
            if rel not in relations:
                relations.append(rel)
        elif kind == "annotate":
            annotations.append({"id": op.get("id"), "note": op.get("note"), "timestamp": op.get("timestamp")})
        elif kind == "deprecate":
            entity_id = op.get("id")
            if entity_id in entities:
                entities[entity_id]["deprecated"] = True
                entities[entity_id]["deprecation_reason"] = op.get("reason")
                entities[entity_id]["updated"] = op.get("timestamp")
    return entities, relations, annotations


def validate_props(entity_type: str, props: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    type_schema = schema.get("types", {}).get(entity_type)
    if not type_schema:
        return [f"Unknown type: {entity_type}"]
    for required in type_schema.get("required", []):
        if required not in props or props.get(required) in (None, ""):
            errors.append(f"Missing required property for {entity_type}: {required}")
    forbidden = set(type_schema.get("forbidden_properties", [])) | SECRET_KEYS
    for key in props:
        if key.lower() in forbidden:
            errors.append(f"Forbidden direct secret-like property on {entity_type}: {key}")
    for key, allowed in type_schema.items():
        if key.endswith("_enum"):
            prop = key[:-5]
            if prop in props and props[prop] not in allowed:
                errors.append(f"Invalid {prop} for {entity_type}: {props[prop]} not in {allowed}")
    if entity_type == "Event" and props.get("end") and props.get("start") and str(props["end"]) < str(props["start"]):
        errors.append("Invalid Event: end must be >= start")
    return errors


def validate_relation(from_id: str, rel: str, to_id: str, entities: Dict[str, Dict[str, Any]], schema: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    if from_id not in entities:
        errors.append(f"Missing from entity: {from_id}")
    if to_id not in entities:
        errors.append(f"Missing to entity: {to_id}")
    rel_schema = schema.get("relations", {}).get(rel)
    if not rel_schema:
        errors.append(f"Unknown relation: {rel}")
        return errors
    if from_id in entities:
        from_type = entities[from_id].get("type")
        allowed_from = rel_schema.get("from_types", [])
        if allowed_from and from_type not in allowed_from:
            errors.append(f"Relation {rel} cannot start from {from_type}")
    if to_id in entities:
        to_type = entities[to_id].get("type")
        allowed_to = rel_schema.get("to_types", [])
        if allowed_to and to_type not in allowed_to:
            errors.append(f"Relation {rel} cannot point to {to_type}")
    return errors


def has_path(edges: Dict[str, List[str]], start: str, target: str, seen: Optional[Set[str]] = None) -> bool:
    seen = seen or set()
    if start == target:
        return True
    if start in seen:
        return False
    seen.add(start)
    return any(has_path(edges, nxt, target, seen) for nxt in edges.get(start, []))


def validate_graph(entities: Dict[str, Dict[str, Any]], relations: List[Dict[str, Any]], schema: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for entity_id, entity in entities.items():
        props = entity.get("properties") or {}
        errors.extend(f"{entity_id}: {err}" for err in validate_props(entity.get("type"), props, schema))
    for relation in relations:
        errors.extend(validate_relation(relation.get("from"), relation.get("rel"), relation.get("to"), entities, schema))
    for rel_name, rel_schema in schema.get("relations", {}).items():
        if not rel_schema.get("acyclic"):
            continue
        edges: Dict[str, List[str]] = {}
        for relation in relations:
            if relation.get("rel") == rel_name:
                edges.setdefault(relation.get("from"), []).append(relation.get("to"))
        for start, targets in edges.items():
            for target in targets:
                if has_path(edges, target, start):
                    errors.append(f"Cycle detected for acyclic relation {rel_name}: {start} -> {target}")
    return errors


def command_create(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    init_store(store)
    schema = load_schema(store)
    props = parse_json_object(args.props, "--props")
    errors = validate_props(args.type, props, schema)
    if errors:
        raise OntologyError("; ".join(errors))
    ops = read_ops(store)
    entities, _, _ = reconstruct(ops)
    if args.id in entities and not args.allow_existing:
        raise OntologyError(f"Entity already exists: {args.id}")
    op = {"op": "create", "entity": {"id": args.id, "type": args.type, "properties": props}}
    append_op(store, op)
    return {"ok": True, "op": "create", "id": args.id, "type": args.type, "properties": props}


def command_update(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    init_store(store)
    props = parse_json_object(args.props, "--props")
    ops = read_ops(store)
    entities, relations, _ = reconstruct(ops)
    if args.id not in entities:
        raise OntologyError(f"Entity not found: {args.id}")
    updated_props = dict(entities[args.id].get("properties") or {})
    updated_props.update(props)
    schema = load_schema(store)
    errors = validate_props(entities[args.id].get("type"), updated_props, schema)
    if errors:
        raise OntologyError("; ".join(errors))
    append_op(store, {"op": "update", "id": args.id, "properties": props})
    return {"ok": True, "op": "update", "id": args.id, "properties": props}


def command_relate(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    init_store(store)
    props = parse_json_object(args.props, "--props") if args.props else {}
    schema = load_schema(store)
    ops = read_ops(store)
    entities, relations, _ = reconstruct(ops)
    errors = validate_relation(args.from_id, args.rel, args.to_id, entities, schema)
    rel_schema = schema.get("relations", {}).get(args.rel, {})
    if rel_schema.get("acyclic"):
        edges: Dict[str, List[str]] = {}
        for relation in relations:
            if relation.get("rel") == args.rel:
                edges.setdefault(relation.get("from"), []).append(relation.get("to"))
        edges.setdefault(args.from_id, []).append(args.to_id)
        if has_path(edges, args.to_id, args.from_id):
            errors.append(f"Cycle detected for acyclic relation {args.rel}: {args.from_id} -> {args.to_id}")
    if errors:
        raise OntologyError("; ".join(errors))
    op = {"op": "relate", "from": args.from_id, "rel": args.rel, "to": args.to_id, "properties": props}
    append_op(store, op)
    return {"ok": True, **op}


def command_annotate(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    init_store(store)
    entities, _, _ = reconstruct(read_ops(store))
    if args.id not in entities:
        raise OntologyError(f"Entity not found: {args.id}")
    append_op(store, {"op": "annotate", "id": args.id, "note": args.note})
    return {"ok": True, "op": "annotate", "id": args.id, "note": args.note}


def command_deprecate(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    init_store(store)
    entities, _, _ = reconstruct(read_ops(store))
    if args.id not in entities:
        raise OntologyError(f"Entity not found: {args.id}")
    append_op(store, {"op": "deprecate", "id": args.id, "reason": args.reason})
    return {"ok": True, "op": "deprecate", "id": args.id, "reason": args.reason}


def current_state(store: Store) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    return reconstruct(read_ops(store))


def command_list(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    entities, _, _ = current_state(store)
    values = [entity for entity in entities.values() if not args.type or entity.get("type") == args.type]
    if not args.include_deprecated:
        values = [entity for entity in values if not entity.get("deprecated")]
    return {"ok": True, "count": len(values), "entities": values}


def command_get(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    entities, relations, annotations = current_state(store)
    entity = entities.get(args.id)
    if not entity:
        raise OntologyError(f"Entity not found: {args.id}")
    outgoing = [r for r in relations if r.get("from") == args.id]
    incoming = [r for r in relations if r.get("to") == args.id]
    notes = [a for a in annotations if a.get("id") == args.id]
    return {"ok": True, "entity": entity, "outgoing": outgoing, "incoming": incoming, "annotations": notes}


def command_query(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    where = parse_json_object(args.where, "--where") if args.where else {}
    entities, _, _ = current_state(store)
    results = []
    for entity in entities.values():
        if args.type and entity.get("type") != args.type:
            continue
        props = entity.get("properties") or {}
        if all(props.get(key) == value for key, value in where.items()):
            results.append(entity)
    return {"ok": True, "count": len(results), "entities": results}


def command_related(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    entities, relations, _ = current_state(store)
    if args.id not in entities:
        raise OntologyError(f"Entity not found: {args.id}")
    selected = []
    for relation in relations:
        if args.rel and relation.get("rel") != args.rel:
            continue
        if args.direction in ("out", "both") and relation.get("from") == args.id:
            selected.append({"direction": "out", **relation, "entity": entities.get(relation.get("to"))})
        if args.direction in ("in", "both") and relation.get("to") == args.id:
            selected.append({"direction": "in", **relation, "entity": entities.get(relation.get("from"))})
    return {"ok": True, "count": len(selected), "relations": selected}


def command_validate(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    schema = load_schema(store)
    entities, relations, _ = current_state(store)
    errors = validate_graph(entities, relations, schema)
    return {"ok": not errors, "errors": errors, "entity_count": len(entities), "relation_count": len(relations)}


def command_schema_append(args: argparse.Namespace, store: Store) -> Dict[str, Any]:
    init_store(store)
    patch = parse_json_object(args.data, "--data")
    schema = load_schema(store)
    for section in ("types", "relations"):
        if section in patch:
            if not isinstance(patch[section], dict):
                raise OntologyError(f"{section} patch must be object")
            schema.setdefault(section, {}).update(patch[section])
    store.schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"ok": True, "schema": str(store.schema_path), "updated_sections": [k for k in ("types", "relations") if k in patch]}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Append-only ontology CLI for OpenCode")
    parser.add_argument("--root", default=".", help="Workspace root containing memory/ontology (default: current directory)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Initialize memory/ontology without overwriting existing files")

    p = sub.add_parser("create", help="Create an entity")
    p.add_argument("--id", required=True)
    p.add_argument("--type", required=True)
    p.add_argument("--props", required=True, help="JSON object")
    p.add_argument("--allow-existing", action="store_true")

    p = sub.add_parser("update", help="Append an entity property update")
    p.add_argument("--id", required=True)
    p.add_argument("--props", required=True, help="JSON object")

    p = sub.add_parser("relate", help="Create a relation")
    p.add_argument("--from", dest="from_id", required=True)
    p.add_argument("--rel", required=True)
    p.add_argument("--to", dest="to_id", required=True)
    p.add_argument("--props", help="JSON object")

    p = sub.add_parser("annotate", help="Append a note to an entity")
    p.add_argument("--id", required=True)
    p.add_argument("--note", required=True)

    p = sub.add_parser("deprecate", help="Mark an entity as deprecated")
    p.add_argument("--id", required=True)
    p.add_argument("--reason", required=True)

    p = sub.add_parser("list", help="List entities")
    p.add_argument("--type")
    p.add_argument("--include-deprecated", action="store_true")

    p = sub.add_parser("get", help="Get one entity with relations")
    p.add_argument("--id", required=True)

    p = sub.add_parser("query", help="Query entities by type and property equality")
    p.add_argument("--type")
    p.add_argument("--where", help="JSON object of property equality filters")

    p = sub.add_parser("related", help="Get incoming/outgoing relations for an entity")
    p.add_argument("--id", required=True)
    p.add_argument("--rel")
    p.add_argument("--direction", choices=["in", "out", "both"], default="both")

    sub.add_parser("validate", help="Validate current graph")

    p = sub.add_parser("schema-append", help="Merge type/relation definitions into schema")
    p.add_argument("--data", required=True, help="JSON object with optional types/relations")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    store = Store(Path(args.root).resolve())
    try:
        if args.command == "init":
            result = init_store(store)
        elif args.command == "create":
            result = command_create(args, store)
        elif args.command == "update":
            result = command_update(args, store)
        elif args.command == "relate":
            result = command_relate(args, store)
        elif args.command == "annotate":
            result = command_annotate(args, store)
        elif args.command == "deprecate":
            result = command_deprecate(args, store)
        elif args.command == "list":
            result = command_list(args, store)
        elif args.command == "get":
            result = command_get(args, store)
        elif args.command == "query":
            result = command_query(args, store)
        elif args.command == "related":
            result = command_related(args, store)
        elif args.command == "validate":
            result = command_validate(args, store)
        elif args.command == "schema-append":
            result = command_schema_append(args, store)
        else:
            raise OntologyError(f"Unknown command: {args.command}")
        emit(result)
        return 0 if result.get("ok", True) else 2
    except OntologyError as exc:
        emit({"ok": False, "error": str(exc)})
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
