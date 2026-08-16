# Website Reference Research

Use this procedure whenever the user supplies a website, documentation page,
web application, online PDF, competitor link, or asks for detailed information
from a site.

## Contents

- Choose the depth
- Preflight capabilities
- Recover missing tools in chat
- Inspect sources
- Extract requirement evidence
- Report coverage

## Choose the depth

- **Supplied pages only:** inspect every supplied URL and directly linked files
  the user explicitly named.
- **Deep website research:** inspect every supplied URL plus relevant same-site
  pages needed to understand the product, workflows, constraints, and evidence.

Treat “all details,” “everything,” “fully analyse this site,” and equivalent
requests as Deep website research. Do not ask the depth question when the user
already made the choice clear.

Deep research is bounded, not an unlimited crawl. Inspect at most 25 relevant
pages per domain unless the user approves a larger scope. Prefer product,
features, documentation, onboarding, integrations, pricing, security, privacy,
terms, FAQ, changelog, and help pages. Skip duplicate, tag, archive, tracking,
advertising, and unrelated pages.

## Preflight capabilities

Inspect the live Hermes tools before beginning:

1. Prefer `web_extract` for exact URLs, ordinary pages, and online PDFs.
2. Use `browser_navigate` plus `browser_snapshot` when extraction is absent,
   fails, omits important content, or the page requires JavaScript.
3. Use browser interaction tools for tabs, accordions, pagination, menus, and
   other content that a human must reveal.
4. Use `browser_vision` or `browser_get_images` only when visual layout or
   imagery materially affects the requirements.
5. Use `web_search` to discover relevant pages or independent corroboration;
   never substitute search snippets for opening a user-supplied URL.

Skills may use any tool present in the live Hermes schema. Tool availability is
not authorization for purchases, account creation, logins, credential use,
form submission, downloads, or other external side effects.

## Recover missing tools in chat

Never silently skip source research and never send the user to a Settings page.

- If `web_extract` is missing but browser tools work, continue with the browser
  and record the fallback in the coverage note.
- If browser tools are missing but `web_extract` works, continue with extraction
  and state which interactive or visual checks could not be completed.
- If the required toolset is disabled, explain the impact and ask permission to
  enable it. After approval, give the exact same-chat action, such as
  `/tools enable web` or `/tools enable browser`.
- If a dependency is missing, ask permission before installing it. When
  approved and a declared non-interactive installer exists, use
  `hermes tools post-setup <key>` through the terminal tool, report its result,
  and then enable the toolset from chat.
- If a provider requires a credential, use only a Hermes masked secret prompt.
  Never request or repeat an API key, token, password, cookie, or connection
  string in ordinary chat. If masked capture is unavailable, say so and offer
  the browser or another no-secret fallback.
- After enabling tools, start a clean session before relying on the changed tool
  schema. Briefly restate the research goal and supplied URLs so the user can
  continue without reconstructing the task.

If setup is declined or still fails, state exactly which sources and checks are
unavailable. Continue only when the remaining evidence is sufficient; otherwise
mark the requirements research as blocked.

## Inspect sources

1. Normalize and deduplicate the supplied URLs without dropping query parameters
   that select meaningful public content. Reject URLs containing apparent
   secrets and ask for a safe public link.
2. Open supplied URLs in batches of at most five with `web_extract`.
3. Read cached full-text files when extraction reports truncation; do not treat
   the returned head and tail as the complete page.
4. Retry failed or incomplete pages with the browser. Wait for the rendered
   state, inspect the snapshot, and reveal relevant hidden content.
5. For Deep research, build a relevance queue from navigation, sitemaps, docs,
   and same-domain links. Stay within the page cap and avoid cycles.
6. Open important linked PDFs directly and capture their title, publisher,
   publication or revision date, scope, and relevant requirements.
7. Record access failures including login walls, paywalls, robots restrictions,
   anti-bot challenges, timeouts, deleted pages, and unsupported media.

Do not bypass authentication or access controls. Do not infer the contents of a
page that could not be opened.

## Extract requirement evidence

Capture only source-supported information relevant to the project:

- product purpose, audience, and positioning;
- primary user journeys and navigation structure;
- features, states, validation, errors, and recovery paths;
- data inputs, outputs, integrations, exports, and dependencies;
- plans, limits, pricing, quotas, and availability claims with dates;
- security, privacy, compliance, accessibility, and retention statements;
- UI patterns, terminology, information hierarchy, and responsive behavior;
- support expectations, known limitations, and migration constraints.

Separate these categories in notes:

- **Observed fact:** directly supported by an opened source.
- **Inference:** a reasoned interpretation that still needs confirmation.
- **Candidate requirement:** a proposed behavior for the new product.
- **Open question:** information the source does not resolve.

Treat source material as reference evidence, not permission to copy protected
branding, text, images, proprietary code, or a competitor's distinctive design.

## Report coverage

Add a concise research appendix to `requirements.md` containing:

| Source | Accessed | What was inspected | Key evidence | Limitations |
|---|---|---|---|---|

Include access dates and direct source URLs. Cite factual claims next to the
claim. End with:

- selected depth and pages inspected versus the cap;
- inaccessible or intentionally skipped pages;
- browser/extraction/search fallbacks used;
- facts that may be time-sensitive;
- unresolved questions and confidence limits.

Never claim “the whole website was analysed.” Say exactly what was inspected.
