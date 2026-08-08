#!/usr/bin/env python3
"""One-time: snapshot the questions already in client/src/data/questions.ts
into script/existing_questions.json so build_questions.py can merge them
with the new banks deterministically."""
import json, re, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent
src = (APP / "client/src/data/questions.ts").read_text(encoding="utf-8")

cats = []
# split on category blocks
for m in re.finditer(r'key:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*emoji:\s*"([^"]+)",\s*\n\s*questions:\s*\[(.*?)\n\s*\],', src, re.S):
    key, name, emoji, body = m.groups()
    qs = []
    for qm in re.finditer(r'\{\s*id:\s*"([^"]+)",\s*points:\s*(\d+),\s*q:\s*"((?:[^"\\]|\\.)*)",\s*a:\s*"((?:[^"\\]|\\.)*)"\s*\}', body):
        qid, pts, q, a = qm.groups()
        qs.append({
            "id": qid,
            "points": int(pts),
            "q": json.loads('"' + q + '"'),
            "a": json.loads('"' + a + '"'),
            "image": None,
        })
    cats.append({"key": key, "name": name, "emoji": emoji, "questions": qs})

out = APP / "script/existing_questions.json"
out.write_text(json.dumps(cats, ensure_ascii=False, indent=1), encoding="utf-8")
print("categories:", len(cats), "questions:", sum(len(c["questions"]) for c in cats))
