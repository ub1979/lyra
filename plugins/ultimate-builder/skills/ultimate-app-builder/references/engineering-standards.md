# Engineering standards

House rules for every project Lyra builds. `sw-developer`, `code-reviewer`,
`qa-engineer` and `sw-architect` all read this file — it is the single source of
truth, so a rule changes here and nowhere else.

---

## 1. One unit per file

A **unit** is a class, a UI component, or a module. Whichever it is:

- it lives alone in a file named after it;
- it has exactly one responsibility, statable in one sentence without "and";
- it has its own test file;
- it is loadable on its own — reading it should not require reading three
  siblings to understand what it does.

Use a class when there is state and behaviour to encapsulate: domain entities,
services, repositories, adapters, long-lived collaborators. Use a module of
named exports when there is not — pure transformations, formatters, validators,
selectors, constants. Use the framework's unit where the framework has one: one
React/Vue component per file; Go structs and interfaces; Rust traits and
modules; Python classes or modules as the code calls for.

Never wrap a pure function in a class to satisfy a rule. A class with no state
and one method is a module wearing a costume, and it costs a constructor, an
instantiation and a mock at every call site.

**File size.** Aim for under ~300 lines. Past ~500, the file is doing more than
one thing — split it. This is not cosmetic: a file that fits in one read is a
file an agent can load, change and verify without pulling half the project into
context.

## 2. Every unit has a test

No exceptions, including units created during a refactor.

- Test file naming follows the language: `test_<unit>.py`, `<unit>.test.ts`,
  `<unit>_test.go`.
- Each test covers: happy path, edge cases (empty, null, boundary, max), error
  cases (invalid input, missing fields, unauthorised), and state transitions
  where the unit holds state.
- A unit without a test is an incomplete unit, not a unit with a follow-up task.
  `code-reviewer` reports it as a finding; QA treats it as an untested area with
  a risk level.

A test is not proof the unit works forever — only that it worked against the
contract it had when the test ran. That is why the class map records *when*, and
why change records say what puts a unit back in doubt.

## 3. The class map

`.sdlc/class-map.md`, maintained by `sw-developer` as units are added, renamed,
split or deleted. It exists so any agent can load exactly one unit and know what
it is, where its test lives, and whether that test still means anything.

```markdown
# Class map

| Unit | Kind | File | Test | Responsibility | Verified |
|---|---|---|---|---|---|
| InvoiceCalculator | class | src/billing/invoice_calculator.py | tests/billing/test_invoice_calculator.py | Totals, tax and rounding for one invoice | 2026-08-21 · 14 tests pass |
| formatCurrency | module | src/format/currency.ts | src/format/currency.test.ts | Money to a locale string | 2026-08-21 · 6 tests pass |
| InvoiceRow | component | src/ui/InvoiceRow.tsx | src/ui/InvoiceRow.test.tsx | One line item, read-only | stale — touched by CR-004 |
```

Rules:

- one row per unit, no orphans: a file with no row, or a row with no file, is a
  review finding;
- **Verified** carries the date and the actual result, never "should pass";
- a unit touched by a change is marked `stale — touched by CR-xxx` until its
  tests run again. Stale rows are what QA re-tests first;
- keep it sorted by path so diffs stay readable.

Read the map before searching the codebase. It is cheaper than a grep and more
honest than memory.

## 4. Change records

Anything that touches existing code gets `.sdlc/changes/CR-<n>-<slug>.md`
**before** the edit, sized to the risk. A one-line fix gets a short one; a
structural change gets the full impact analysis from `sw-architect`.

```markdown
# CR-004: Split payment retry out of OrderService

## What changes
OrderService loses retry handling; new PaymentRetryPolicy owns it.

## Why
Retry rules changed per payment provider; they do not belong to order lifecycle.
Requirement: FR-021.

## Blast radius
| Touched | Kind | Risk |
|---|---|---|
| src/orders/order_service.py | modified | HIGH — every checkout path |
| src/payments/payment_retry_policy.py | new | MEDIUM |
| src/api/checkout.py | caller updated | MEDIUM |

Downstream: the `/checkout` endpoint contract is unchanged. No migration.

## Units put back in doubt
OrderService · CheckoutController · PaymentRetryPolicy (new)

## What QA must test
- Checkout succeeds first try (regression)
- Provider declines once, retry succeeds
- Provider declines three times → order fails, cart preserved
- Concurrent checkout on the same cart

## Rollback
Revert the commit; no data change. Feature flag not required.
```

Rules:

- **written before the change**, not after — a record reconstructed from a diff
  records what happened, not what was intended, and cannot be reviewed;
- "Units put back in doubt" drives the class map's stale rows and QA's regression
  scope. If a change puts nothing in doubt, say so explicitly;
- risk levels are CRITICAL / HIGH / MEDIUM / LOW, with one reason each;
- link the requirement or finding that caused it. A change with no cause is a
  change nobody asked for.

## 5. Design patterns

Apply a pattern when the problem is the one the pattern solves — Repository for
data access, Factory for construction that varies, Strategy for interchangeable
behaviour, Observer for fan-out, Adapter for a foreign interface. Record the
choice: pattern, why, alternative rejected. One line in the ADR or the change
record is enough.

Do not apply a pattern because the project "should have patterns". Indirection
you cannot justify in one sentence is indirection the next reader has to
reverse-engineer.
