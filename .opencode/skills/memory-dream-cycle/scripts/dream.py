#!/usr/bin/env python3
"""Memory Dream Cycle for OpenCode.

Scans local learning logs and ontology state, consolidates recurring themes, and
proposes safe promotions. Defaults to dry-run; use --apply only when explicitly
approved by the user.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ENTRY_RE = re.compile(r"^## \[(?P<id>[A-Z]+-\d{8}-[A-Z0-9]+)\]\s*(?P<title>.*)$", re.MULTILINE)
FIELD_RE = re.compile(r"^\*\*(?P<key>[^*]+)\*\*:\s*(?P<value>.*)$", re.MULTILINE)
WORD_RE = re.compile(r"[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_.-]{3,}")

STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "para", "con", "del", "las", "los",
    "una", "uno", "que", "por", "como", "cuando", "status", "logged", "summary", "details", "metadata",
    "related", "files", "source", "priority", "area", "pending", "resolved", "promoted", "tools", "docs",
}


@dataclass
class Paths:
    root: Path

    @property
    def learnings_dir(self) -> Path:
        return self.root / ".learnings"

    @property
    def ontology_graph(self) -> Path:
        return self.root / "memory" / "ontology" / "graph.jsonl"

    @property
    def dream_dir(self) -> Path:
        return self.root / "memory" / "dreams"

    @property
    def reports_dir(self) -> Path:
        return self.dream_dir / "reports"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def today_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def emit(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True))


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def split_entries(text: str, source: str) -> List[Dict[str, Any]]:
    matches = list(ENTRY_RE.finditer(text))
    entries: List[Dict[str, Any]] = []
    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        fields = {m.group("key").strip().lower().replace(" ", "_"): m.group("value").strip() for m in FIELD_RE.finditer(body)}
        entries.append({
            "id": match.group("id"),
            "title": match.group("title").strip(),
            "source": source,
            "status": fields.get("status", "unknown"),
            "priority": fields.get("priority", "unknown"),
            "area": fields.get("area", "unknown"),
            "body": body,
            "fields": fields,
        })
    return entries


def scan_learnings(paths: Paths) -> Dict[str, Any]:
    files = ["LEARNINGS.md", "ERRORS.md", "FEATURE_REQUESTS.md"]
    entries: List[Dict[str, Any]] = []
    file_status: Dict[str, Any] = {}
    for filename in files:
        path = paths.learnings_dir / filename
        text = read_text(path)
        found = split_entries(text, filename)
        entries.extend(found)
        file_status[filename] = {"exists": path.exists(), "entry_count": len(found)}
    return {"files": file_status, "entries": entries}


def scan_ontology(paths: Paths) -> Dict[str, Any]:
    if not paths.ontology_graph.exists():
        return {"exists": False, "op_count": 0, "entity_count": 0, "relation_count": 0, "errors": []}
    ops: List[Dict[str, Any]] = []
    errors: List[str] = []
    for line_no, line in enumerate(read_text(paths.ontology_graph).splitlines(), 1):
        if not line.strip():
            continue
        try:
            op = json.loads(line)
            ops.append(op)
        except json.JSONDecodeError as exc:
            errors.append(f"line {line_no}: {exc}")
    entities = {op.get("entity", {}).get("id") for op in ops if op.get("op") == "create"}
    relations = [op for op in ops if op.get("op") == "relate"]
    op_types = Counter(op.get("op", "unknown") for op in ops)
    return {
        "exists": True,
        "op_count": len(ops),
        "entity_count": len([x for x in entities if x]),
        "relation_count": len(relations),
        "op_types": dict(op_types),
        "errors": errors,
    }


def tokenize(text: str) -> List[str]:
    words = [w.lower().strip("._-") for w in WORD_RE.findall(text)]
    return [w for w in words if is_signal_word(w)]


def is_signal_word(word: str) -> bool:
    if word in STOPWORDS or word.isdigit():
        return False
    if re.match(r"^\d{4}-\d{2}-\d{2}", word):
        return False
    if re.match(r"^\d{2}z$", word):
        return False
    if re.match(r"^\d{2}:\d{2}", word):
        return False
    if re.match(r"^lrn-\d+", word) or re.match(r"^err-\d+", word) or re.match(r"^feat-\d+", word):
        return False
    return True


def entry_keywords(entry: Dict[str, Any]) -> List[str]:
    counter = Counter(tokenize(entry.get("title", "") + "\n" + entry.get("body", "")))
    return [word for word, _ in counter.most_common(8)]


def consolidate(entries: List[Dict[str, Any]], ontology: Dict[str, Any]) -> Dict[str, Any]:
    status_counts = Counter(e.get("status", "unknown") for e in entries)
    priority_counts = Counter(e.get("priority", "unknown") for e in entries)
    area_counts = Counter(e.get("area", "unknown") for e in entries)

    keyword_to_entries: Dict[str, List[str]] = defaultdict(list)
    for entry in entries:
        for keyword in entry_keywords(entry):
            keyword_to_entries[keyword].append(entry["id"])

    recurring = [
        {"keyword": key, "entry_ids": ids, "count": len(ids)}
        for key, ids in keyword_to_entries.items()
        if len(set(ids)) >= 2
    ]
    recurring.sort(key=lambda item: (-item["count"], item["keyword"]))

    unresolved = [e for e in entries if e.get("status") in {"pending", "in_progress", "unknown"}]
    high_priority = [e for e in entries if e.get("priority") in {"high", "critical"}]

    themes = []
    for item in recurring[:10]:
        theme_entries = [e for e in entries if e["id"] in set(item["entry_ids"])]
        themes.append({
            "theme": item["keyword"],
            "count": item["count"],
            "entry_ids": item["entry_ids"],
            "suggested_rule": suggest_rule(item["keyword"], theme_entries),
        })

    return {
        "entry_count": len(entries),
        "status_counts": dict(status_counts),
        "priority_counts": dict(priority_counts),
        "area_counts": dict(area_counts),
        "unresolved_count": len(unresolved),
        "high_priority_count": len(high_priority),
        "themes": themes,
        "ontology_health": ontology,
    }


def suggest_rule(keyword: str, entries: List[Dict[str, Any]]) -> str:
    sources = sorted({e.get("source", "unknown") for e in entries})
    if any(src == "ERRORS.md" for src in sources):
        return f"Before repeating work involving `{keyword}`, check prior errors and prefer a safer documented path."
    if any(src == "FEATURE_REQUESTS.md" for src in sources):
        return f"Consider turning recurring `{keyword}` requests into a tracked task, skill, or documented capability."
    return f"Promote recurring learning around `{keyword}` into a concise prevention rule if it applies beyond one task."


def promotion_candidates(entries: List[Dict[str, Any]], summary: Dict[str, Any]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    for theme in summary.get("themes", [])[:10]:
        if theme["count"] >= 2:
            candidates.append({
                "kind": "theme",
                "target": choose_target(theme["theme"]),
                "reason": f"Recurring theme `{theme['theme']}` appears in {theme['count']} entries.",
                "entry_ids": theme["entry_ids"],
                "suggested_text": theme["suggested_rule"],
            })
    for entry in entries:
        if entry.get("priority") == "critical" or entry.get("priority") == "high":
            candidates.append({
                "kind": "entry",
                "target": choose_target(entry.get("area", "")),
                "reason": f"High-priority memory entry {entry['id']} should be reviewed for promotion.",
                "entry_ids": [entry["id"]],
                "suggested_text": first_summary_line(entry),
            })
    return candidates


def choose_target(topic: str) -> str:
    topic = (topic or "").lower()
    if any(x in topic for x in ["tool", "cli", "powershell", "bash", "plugin"]):
        return "TOOLS.md"
    if any(x in topic for x in ["agent", "workflow", "delegation", "protocolo"]):
        return "AGENTS.md"
    if any(x in topic for x in ["skill", "prompt", "trigger"]):
        return "relevant SKILL.md"
    return "Engram + project docs"


def first_summary_line(entry: Dict[str, Any]) -> str:
    body = entry.get("body", "")
    marker = "### Summary"
    if marker in body:
        after = body.split(marker, 1)[1].strip().splitlines()
        for line in after:
            if line.strip() and not line.startswith("###"):
                return line.strip()
    return entry.get("title") or entry.get("id")


def scan(paths: Paths) -> Dict[str, Any]:
    learning = scan_learnings(paths)
    ontology = scan_ontology(paths)
    return {
        "ok": True,
        "timestamp": now_iso(),
        "root": str(paths.root),
        "learnings": {"files": learning["files"], "entry_count": len(learning["entries"]), "entries": learning["entries"]},
        "ontology": ontology,
    }


def make_report(paths: Paths) -> Dict[str, Any]:
    scanned = scan(paths)
    entries = scanned["learnings"]["entries"]
    summary = consolidate(entries, scanned["ontology"])
    candidates = promotion_candidates(entries, summary)
    return {
        "ok": True,
        "timestamp": scanned["timestamp"],
        "root": scanned["root"],
        "summary": summary,
        "promotion_candidates": candidates,
        "next_actions": next_actions(summary, candidates),
    }


def next_actions(summary: Dict[str, Any], candidates: List[Dict[str, Any]]) -> List[str]:
    actions: List[str] = []
    if summary.get("unresolved_count", 0):
        actions.append(f"Review {summary['unresolved_count']} unresolved learning entries.")
    if summary.get("high_priority_count", 0):
        actions.append(f"Prioritize {summary['high_priority_count']} high/critical entries.")
    if candidates:
        actions.append(f"Review {len(candidates)} promotion candidates before applying changes.")
    ontology = summary.get("ontology_health", {})
    if ontology.get("errors"):
        actions.append("Fix ontology JSONL parse errors before relying on graph queries.")
    if not actions:
        actions.append("No immediate dream-cycle action needed.")
    return actions


def write_report(paths: Paths, report: Dict[str, Any], apply: bool) -> Optional[Path]:
    if not apply:
        return None
    paths.reports_dir.mkdir(parents=True, exist_ok=True)
    out = paths.reports_dir / f"dream-report-{today_stamp()}.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return out


def append_promotion_plan(paths: Paths, report: Dict[str, Any], apply: bool) -> Optional[Path]:
    if not apply:
        return None
    paths.dream_dir.mkdir(parents=True, exist_ok=True)
    out = paths.dream_dir / "promotion-plan.md"
    lines = [f"## Dream Cycle {now_iso()}", "", "### Promotion Candidates"]
    for candidate in report.get("promotion_candidates", []):
        lines.extend([
            f"- **Target**: {candidate['target']}",
            f"  - Reason: {candidate['reason']}",
            f"  - Entries: {', '.join(candidate['entry_ids'])}",
            f"  - Suggested Text: {candidate['suggested_text']}",
        ])
    lines.extend(["", "### Next Actions"])
    lines.extend([f"- {action}" for action in report.get("next_actions", [])])
    lines.append("\n---\n")
    with out.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    return out


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="OpenCode memory dream-cycle scanner and consolidator")
    parser.add_argument("--root", default=".", help="Workspace root (default: current directory)")
    parser.add_argument("--apply", action="store_true", help="Write reports/plans. Default is dry-run.")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("scan", help="Scan .learnings and ontology and print raw inventory")
    sub.add_parser("consolidate", help="Print consolidated themes and memory health")
    sub.add_parser("promote", help="Print promotion candidates; with --apply, append promotion plan")
    sub.add_parser("run", help="Run full dream cycle; with --apply, write report and promotion plan")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    paths = Paths(Path(args.root).resolve())
    if args.command == "scan":
        result = scan(paths)
    elif args.command == "consolidate":
        report = make_report(paths)
        result = {"ok": True, "dry_run": not args.apply, "summary": report["summary"], "next_actions": report["next_actions"]}
    elif args.command == "promote":
        report = make_report(paths)
        plan_path = append_promotion_plan(paths, report, args.apply)
        result = {"ok": True, "dry_run": not args.apply, "promotion_candidates": report["promotion_candidates"], "written": str(plan_path) if plan_path else None}
    elif args.command == "run":
        report = make_report(paths)
        report_path = write_report(paths, report, args.apply)
        plan_path = append_promotion_plan(paths, report, args.apply)
        result = {"ok": True, "dry_run": not args.apply, "report": report, "written": {"report": str(report_path) if report_path else None, "promotion_plan": str(plan_path) if plan_path else None}}
    else:
        result = {"ok": False, "error": f"Unknown command {args.command}"}
    emit(result)
    return 0 if result.get("ok") else 2


if __name__ == "__main__":
    raise SystemExit(main())
