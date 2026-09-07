# Context, memory and token use

Lyra keeps project decisions and evidence references in `.sdlc/project-brain.md`.
This is a retrieval map, not proof that a claim is correct. Specialists still
inspect relevant source and tests. General memory and past-conversation search
remain available to the coordinator.

For routine progress, `hermes project-run status --summary --workspace <path>`
reads live saved jobs and returns a small JSON view. It makes no AI call and does
not cache old liveness. Counts cover every job; omitted jobs and shortened reasons
are explicitly flagged. Remove `--summary` for details. A completed job is not
the same as a reviewed, finished application.

Default Studio coordinators carry interviewing, file, terminal, research and
memory tools. Durable specialists keep their normal working toolsets. Optional
configured capabilities and explicit toolset overrides are preserved. Toolsets
are selected when the agent is created, not changed as each phase starts.

Caching is provider-dependent. Lyra preserves stable instructions, tools and
earlier conversation messages so existing provider caching can reuse them.
It does not repeatedly replace history with summaries; normal context compression
remains the boundary for refreshing context. Stale progress and unverified
answers are never cached as a substitute for checking current evidence.

These changes reduce unnecessary context, not the model's reasoning effort,
specialist instructions, tests, approval gates or recovery checks. Existing
running agents are not hot-swapped; activate the update during a safe restart.
