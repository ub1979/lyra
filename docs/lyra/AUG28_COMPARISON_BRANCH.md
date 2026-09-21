# Lyra 28 August comparison branch

Branch: `codex/aug28-ui-brain`

This branch starts from commit `602acf701` (Lyra 0.19.5, 28 August 2026).
It is intended for a controlled comparison with current Lyra.

## Included

- The 28 August direct specialist workflow using `delegate_task`.
- The modern Lyra Studio visual shell introduced after that checkpoint,
  including dark mode, text sizing, model settings, and consistent dialogs.
- A bounded Project Brain at `.sdlc/project-brain.md`, refreshed at meaningful
  verified milestones, before context compression, or at handoff.
- Project Brain freshness, size, and project-local evidence checks.

## Deliberately excluded

- Lyra's later mandatory `project-run` coordinator.
- Kanban-backed phase jobs and work-unit decomposition.
- The later restricted coordinator toolset.
- Mandatory Project Brain rewrites after every worker action.

Hermes' general infrastructure remains at the 28 August revision. This branch
therefore compares the older execution model with the newer product interface
and project memory, rather than mixing in later scheduling behaviour.

## Run

Stop the other Lyra checkout first, then run:

```bash
cd /Users/u/funcoding/lyra-aug28-ui-brain
./start.sh
```

For a clean comparison, give both versions the same model and equivalent copies
of the same test project. Compare whether Lyra launches the application,
exercises real user flows, fixes failures, completes the requested product, and
how many total model tokens it uses.
