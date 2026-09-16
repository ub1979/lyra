# Bounded batches of inline reads

Problem: every inline-capped read bypasses aggregate reduction; ten 24 KB reads
can consume 240 KB despite a 32 KB turn target.
Scope: bound the inline-result portion of a batch without cutting admitted
documents into previews. Extra results become explicit omission notices and can
be read separately from their original source. No historical message rewrite,
file deletion, memory inference or new tool. Default worker budgets unchanged.
Acceptance: a single admissible Project Brain remains whole; repeated large
reads cannot bypass the batch cap; tool-call IDs and ordering remain intact.
This is not a universal hard context limit: other tools retain existing spill
semantics and prompt/system/schema costs are separate.
Verification: 108 admission/budget/storage/coordinator tests passed, including
source retention. All 463 web tests, typecheck and build passed; lint zero errors
(30 existing warnings). No live-provider calls.
Compatibility: backend restart. Rollback by reverting; no stored data changes.
User authorized separate version/commit/push.
