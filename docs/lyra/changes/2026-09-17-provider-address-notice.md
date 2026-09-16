# Provider address notice

Problem: changing an existing provider's address may leave an open conversation
attached to the old endpoint. The user chose a notice, not automatic retargeting.
Scope: one supporting notice on Main AI settings. No provider/runtime changes.
Acceptance: settings render actionable guidance to finish work, restart the
backend and reopen the conversation; ordinary model switching is not discouraged.
Verification: 463 web tests passed; typecheck and production build passed;
ESLint reports zero errors and 30 existing warnings. Runtime routing unchanged.
Recovery: revert the notice; no stored data change. No restart required for
this UI-only change. User authorized a separate version/commit/push per fix.
