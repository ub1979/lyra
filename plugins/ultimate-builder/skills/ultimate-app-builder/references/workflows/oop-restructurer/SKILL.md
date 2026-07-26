---
name: oop-restructurer
description: Converts procedural code into one-class-per-file, dependency-injected OOP with the house comment style while preserving behavior exactly, then dispatches code review. Use when the user mentions: convert to OOP, restructure, refactor to classes, one class per file, add comments, comment style, modularize.
---

# OOP Restructurer

Converts working code into a clean, class-based, one-class-per-file architecture with the house comment style — **without changing behavior**. The code that ran before must run identically after. Same command, same inputs, same outputs. The ONLY differences are structure, testability, and comments.

---

## ⛔ ENFORCEMENT: BEHAVIOR PRESERVATION IS THE PRIME DIRECTIVE

> This is a **refactoring**, not a rewrite. If you cannot prove the restructured code behaves identically to the original, the restructure FAILED.
> - Capture baseline behavior BEFORE touching anything.
> - Move logic **verbatim** — do not "fix" bugs, do not "improve" algorithms, do not rename outputs, do not change defaults. If you spot a bug, note it in the report; do NOT fix it silently.
> - Verify against the baseline AFTER. Any diff = stop and fix the restructure, not the expectation.

---

## Phase 0 — Scope & Baseline Capture

### 0.1 Identify the target

Determine what to restructure: the file(s)/module(s) the user named, or ask-free default = the main source files of the project (exclude tests, generated code, vendored code, migrations, config).

```bash
ls; cat README.md 2>/dev/null | head -30
git status --porcelain   # warn if dirty — commit or stash first so the refactor is revertible
```

If the working tree is dirty, commit or stash before starting so the restructure is a clean, revertible unit.

### 0.2 Capture the behavior baseline (golden master)

This is mandatory. Choose every applicable method:

1. **Existing test suite** — run it, save full output:
   ```bash
   pytest -q 2>&1 | tee .sdlc/oop-baseline-tests.txt   # or npm test, go test ./...
   ```
2. **Runnable entry point** — run the program with representative inputs, capture stdout/stderr/exit code/produced files:
   ```bash
   python main.py <typical args> > .sdlc/oop-baseline-run.txt 2>&1; echo "exit=$?" >> .sdlc/oop-baseline-run.txt
   ```
3. **No tests and no easy run?** Write **characterization tests** FIRST — quick tests that pin down current observable behavior of key functions (call with sample inputs, assert current outputs, even weird ones). These become the safety net.

Record in `.sdlc/oop-baseline-*.txt`. If literally nothing is executable (e.g., missing credentials), state this limitation in the final report and rely on characterization tests for pure logic plus careful line-by-line diff review.

---

## Phase 1 — Design the Class Decomposition

Read ALL target code first. Then design the target architecture on paper (in the report) before moving code.

### 1.1 Map responsibilities to classes

- Group related functions + the data they share → one class each (state becomes instance attributes, shared params become constructor args).
- Follow **Single Responsibility**: one class = one reason to change. Name classes after their responsibility (`ConfigLoader`, `ReportGenerator`, `PaymentValidator`) — nouns, not verbs.
- **One class per file.** File name matches the class: `report_generator.py` → `ReportGenerator` (Python: snake_case file / PascalCase class; JS/TS: match project convention).
- Keep an orchestrator/facade class (e.g. `App` or `<Name>App`) that wires the classes together, plus a thin entry-point file (`main.py`) that preserves the ORIGINAL invocation: if users ran `python script.py args`, that exact command must still work — keep the original file as a thin shim that delegates to the new structure if needed.

### 1.2 Apply SOLID + best practices (verify against current guidance with WebSearch if uncertain)

- **S**ingle Responsibility — one job per class.
- **O**pen/Closed — extension points via composition, not modification.
- **L**iskov Substitution — subclasses must be drop-in substitutable; prefer NO inheritance unless the original code genuinely models an is-a hierarchy.
- **I**nterface Segregation — small focused public methods; keep helpers private (`_prefix` / `#private`).
- **D**ependency Inversion / **Injection** — classes receive collaborators via constructor parameters (with the original values as defaults), never construct hidden dependencies or reach for globals. This is what makes each class **independently testable**: any class can be instantiated alone in a test with fakes/mocks passed in.
- **Composition over inheritance.** Max inheritance depth 1 unless the domain demands more.
- **No god classes** — if a class exceeds ~300 lines or ~10 public methods, split it.
- **No over-engineering** — no abstract base classes, factories, or interfaces "for the future". A 30-line script becomes 1–2 classes, not 6. Every class must earn its existence.
- Module-level constants stay module-level or become class constants; module-level mutable state becomes instance state.

### 1.3 Write the decomposition plan

Before editing, write the plan into `restructure-report.md`: table of `original function/block → target class.method → target file`. Every line of original logic must be accounted for.

## Phase 2 — Restructure (move logic verbatim)

Work incrementally, one class at a time:

1. Create the new file for the class.
2. Move the function bodies **verbatim** — identical logic, identical order of operations, identical error messages, identical defaults. Converting `function(x, shared)` → `self.method(x)` with `shared` as instance state is allowed; changing what it computes is not.
3. Convert module-level script flow into the orchestrator's methods; the entry file becomes:
   ```python
   from app import App
   if __name__ == '__main__':
       App().run()
   ```
   preserving argument parsing exactly as before.
4. After EACH class extraction, run the fastest baseline check (import + smoke run) to catch breaks early instead of at the end.

**Scope discipline:** do not touch files outside the target, do not upgrade dependencies, do not reformat unrelated code, do not rename user-facing CLI flags/env vars/output files.

## Phase 3 — Apply the Comment Style

Read `references/comment-style.md` (in this skill's directory) and apply it to EVERY restructured file. Non-negotiable rules:

1. File header block (77-char `=` separators) with date, description, author.
2. Imports wrapped with separators + `# Importing the libraries`.
3. Class doc block before every class.
4. Double 77-char separator header before EVERY function/method with `-> input type to output type`.
5. Triple-quote doc after every `def` listing each parameter.
6. 34-char separator before EVERY `if`/`elif`/`else`.
7. Section (37) and minor (22) separators for logic groups.
8. End-of-file double separator.

Exact widths matter: **77 / 37 / 34 / 22**. Follow the worked example in the reference file.

## Phase 4 — Verify Independence & Behavior

### 4.1 Per-class unit tests (proves independent testability)

For every new class, write at least one unit test that instantiates it **alone** (with fakes/stubs for injected dependencies) and exercises its main method. If a class cannot be tested without booting the whole app, the decomposition is wrong — fix the dependency injection, don't skip the test.

```bash
pytest tests/ -q   # all new per-class tests must pass
```

### 4.2 Golden-master comparison (proves behavior preservation)

Re-run EXACTLY what was captured in Phase 0 and diff:

```bash
pytest -q 2>&1 | tee .sdlc/oop-after-tests.txt
python main.py <same args> > .sdlc/oop-after-run.txt 2>&1; echo "exit=$?" >> .sdlc/oop-after-run.txt
diff .sdlc/oop-baseline-run.txt .sdlc/oop-after-run.txt && echo "BEHAVIOR PRESERVED"
```

- Original test suite: every test that passed before must pass after (same failures allowed if they failed before — record them).
- Run output: byte-identical (modulo timestamps/PIDs — if outputs contain those, normalize both sides the same way and say so in the report).
- Any real diff → fix the restructured code until the diff disappears. Never edit the baseline.

## Phase 5 — Dispatch Code Review

**REQUIRED:** After verification passes, invoke the `llm:code-reviewer` skill (or spawn the `code-reviewer` agent) on the restructured code. Give it: the list of new/changed files, the decomposition plan, and the note that this was a behavior-preserving restructure (so it flags any behavior change as CRITICAL). Apply its MUST-FIX findings, then re-run Phase 4 verification.

## Phase 6 — Report

Write `restructure-report.md`:

```markdown
# OOP Restructure Report
## Before → After map
| Original | New class.method | File |
## Class diagram (text)
## Behavior verification
- Baseline: <how captured> | After: <result> | Diff: NONE / explained
- Test suite: X passed before, X passed after
## Per-class tests added
## Comment style: applied to N files (77/37/34/22 checklist passed)
## Code review: <verdict + fixes applied>
## Bugs noticed but NOT fixed (behavior preservation)
```

---

## Red Flags — STOP and Restart the Step

- "I'll just fix this small bug while I'm here" → NO. Note it in the report.
- "The output diff is close enough" → NO. Identical or explain every character.
- "This class needs the whole app to test" → decomposition is wrong; inject the dependency.
- "I'll skip the baseline, the code is simple" → NO baseline = NO proof = failed restructure.
- "The comment separators are roughly the right length" → count them: 77/37/34/22.
- Creating interfaces/factories/abstract classes the current code doesn't need → delete them.
