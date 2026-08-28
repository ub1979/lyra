---
name: researcher
description: Investigate web questions with verified, cited sources.
license: MIT
metadata:
  hermes:
    tags: [Research, Web, Search, Fact-Checking, Sources]
    related_skills: [arxiv, duckduckgo-search, searxng-search, parallel-cli]
---

# Researcher

Investigate questions on the public internet and turn the evidence into a
clear, current, well-cited answer. Optimize for correctness and traceability,
not for the number of search results collected.

## Match the depth to the request

- **Lookup:** One narrow fact. Confirm it from an authoritative page and answer
  directly.
- **Research brief:** Several claims, a comparison, or a recommendation. Search
  from multiple angles and verify the important claims independently.
- **Deep investigation:** A broad, disputed, high-stakes, or poorly documented
  topic. Break it into subquestions, maintain evidence notes, resolve conflicts,
  and state what remains unknown.

Infer the lightest depth that can answer reliably. Ask a question only when a
missing choice would materially change the research; otherwise begin and state
the reasonable scope used.

## Research workflow

1. **Define the answer before searching.** Convert the request into a small set
   of subquestions and identify which facts are time-sensitive.
2. **Search for breadth.** Use several meaningfully different queries: the main
   terms, likely synonyms, a source-specific query, and a query designed to
   uncover criticism, limitations, or contradictory evidence. Parallelize
   independent searches when possible.
3. **Open the evidence.** Search snippets are leads, not evidence. Read the
   relevant page, document, dataset, paper, or official announcement before
   using it to support a claim.
4. **Prefer the closest source.** Use official documentation, laws, standards,
   filings, datasets, research papers, and first-party announcements for what
   they directly establish. Use reputable independent reporting or analysis
   for context and external scrutiny.
5. **Verify important claims.** Cross-check consequential, surprising,
   disputed, or fast-changing claims with an independent source. For technical
   claims, prefer current official documentation or the original paper.
6. **Reconcile conflicts.** Check publication date, event date, definitions,
   geography, sample, version, and whether one source is merely repeating
   another. Report a genuine unresolved disagreement instead of choosing the
   convenient result.
7. **Stop when the evidence converges.** Continue only while another search is
   likely to change the answer, close a material gap, or resolve a conflict.

## Tool routing

- Start with Lyra's native `web_search` for discovery and `web_extract` or the
  browser tools for reading selected sources.
- Use the `arxiv` skill for focused paper discovery and citation trails.
- If native search is unavailable, load `duckduckgo-search` or
  `searxng-search` and follow its availability checks.
- Use `parallel-cli` when the user requests Parallel or the task benefits from
  its paid deep-research, enrichment, entity-discovery, or monitoring workflow.
- Do not install a service, create an account, or spend money without the
  user's authorization.

## Evidence discipline

For each material claim, keep compact working notes with:

- the claim or subquestion;
- the direct source URL, publisher, and publication or update date;
- what the source actually supports;
- whether the point is fact, source-reported claim, or inference;
- confidence and any contradiction that remains.

Treat freshness as part of correctness. For changing topics, include the date
checked and distinguish when an event happened from when an article was
published. Do not treat multiple pages that repeat the same original report as
independent confirmation.

Never invent a citation, author, quotation, statistic, or access date. Do not
bypass paywalls, authentication, access controls, or site restrictions. Keep
quotations short and prefer accurate paraphrase.

## Answer contract

- Lead with the answer or strongest finding, not a diary of searches.
- Cite material factual claims with direct links to the pages that support
  them; do not link to search-result pages.
- Separate established findings, reasonable inferences, and unknowns.
- Include dates where recency affects interpretation.
- For comparisons, use the same criteria and time window for every option.
- Mention limitations or conflicting evidence that could change the decision.
- Match detail to the user's request; include a short source list only when it
  improves navigation beyond the inline citations.
