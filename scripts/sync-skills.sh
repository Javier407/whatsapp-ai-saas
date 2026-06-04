#!/usr/bin/env bash
#
# sync-skills.sh — keep Claude's skills in sync with the canonical Codex set.
#
# .codex/skills/ is the SINGLE SOURCE OF TRUTH. .claude/skills/ is generated from
# it so that Claude Code and Codex use the same skills without manual drift.
# Edit skills under .codex/skills/ ONLY, then run this script (or let the
# SessionStart hook run it) to refresh .claude/skills/.
#
# Cross-platform (bash): works on Git Bash (Windows), macOS, and Linux. No symlinks
# or junctions — both directories are real, so git, bash, Claude, and Codex all
# behave normally.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/.codex/skills"
DST="$ROOT/.claude/skills"

if [ ! -d "$SRC" ]; then
  echo "sync-skills: canonical source not found: $SRC" >&2
  exit 1
fi

rm -rf "$DST"
mkdir -p "$DST"
cp -r "$SRC/." "$DST/"

count="$(find "$DST" -name SKILL.md | wc -l | tr -d ' ')"
echo "sync-skills: .claude/skills synced from .codex/skills ($count skills)"
