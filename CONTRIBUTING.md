# Contributing to Lyra

Thanks for your interest in contributing! This guide explains how to submit changes safely — every contribution goes through code review before it reaches `main`.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Setting Up Your Development Environment](#setting-up-your-development-environment)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [What Makes a Good PR](#what-makes-a-good-pr)
- [Coding Standards](#coding-standards)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful. Be constructive. We're building something together.

- No harassment, discrimination, or personal attacks
- Assume good intent — ask before judging
- Keep discussions technical and focused
- Welcome newcomers — everyone started somewhere

---

## How to Contribute

### Step 1: Fork the Repository

Click the **Fork** button at the top of [github.com/ub1979/lyra](https://github.com/ub1979/lyra) to create your own copy.

### Step 2: Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/lyra.git
cd lyra
```

### Step 3: Add the Upstream Remote

```bash
git remote add upstream https://github.com/ub1979/lyra.git
```

### Step 4: Keep Your Fork Updated

Before starting work, sync with upstream:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

---

## Setting Up Your Development Environment

### Prerequisites

- Python 3.11+
- Node.js 20+
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### Backend Setup

```bash
# Install Python dependencies
uv sync

# Copy environment config
cp .env.example .env
# Edit .env with your API keys
```

### Frontend Setup (Dashboard)

```bash
cd web
npm install
npm run dev        # starts Vite dev server on :5173
```

### Running Tests

```bash
# Frontend tests
cd web && npm test

# TypeScript check
cd web && npx tsc --noEmit

# Python tests (from root)
pytest tests/ -x
```

---

## Making Changes

### Branch Naming

Create a branch from `main` with a descriptive name:

```bash
git checkout -b feat/add-dark-theme       # new feature
git checkout -b fix/sidebar-overflow       # bug fix
git checkout -b docs/update-install-guide  # documentation
git checkout -b refactor/simplify-routing  # refactoring
```

### Commit Messages

Write clear, concise commit messages:

```
feat: add model switching in guided builder
fix: prevent sidebar collapse on mobile
docs: add Docker backend setup instructions
refactor: simplify plugin loading logic
```

Format: `type: short description`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

### What to Avoid

- Don't commit `.env` files, API keys, or secrets
- Don't commit `node_modules/`, `.venv/`, or build artifacts
- Don't modify `package-lock.json` unless you're changing dependencies
- Don't make unrelated changes in the same PR

---

## Pull Request Process

### Before Submitting

1. **Sync with upstream**: `git fetch upstream && git rebase upstream/main`
2. **Run tests**: `cd web && npm test && npx tsc --noEmit`
3. **Test your changes**: If it's a UI change, test it in the browser
4. **Keep it focused**: One feature or fix per PR

### Submitting Your PR

1. Push your branch: `git push origin feat/my-feature`
2. Go to [github.com/ub1979/lyra](https://github.com/ub1979/lyra) — you'll see a banner to create a PR
3. Fill out the PR template:
   - **Summary**: What does this change? Why?
   - **Test plan**: How did you verify it works?
   - **Screenshots**: Required for any UI changes

### Review Process

- **All PRs require at least 1 approving review** before merge
- Maintainers may request changes — this is normal and constructive
- Address review comments by pushing new commits (don't force-push during review)
- Once approved, a maintainer will merge your PR

### After Merge

- Delete your feature branch
- Sync your fork: `git fetch upstream && git checkout main && git merge upstream/main`

---

## What Makes a Good PR

### Do

- Solve one problem well
- Include a clear description of what and why
- Add tests for new functionality
- Include screenshots for UI changes
- Keep diffs small and reviewable (under 500 lines ideally)
- Respond to review feedback promptly

### Don't

- Bundle multiple unrelated changes
- Submit work-in-progress without marking as Draft
- Ignore failing tests or type errors
- Refactor unrelated code while fixing a bug
- Add dependencies without discussing first

---

## Coding Standards

### TypeScript / React (Frontend)

- Strict TypeScript — no `any` unless absolutely necessary
- Functional components with hooks
- Use the existing component patterns in `web/src/`
- CSS: use Tailwind utilities; add custom CSS to `index.css` only when utilities won't work
- Test with Vitest

### Python (Backend)

- Type hints on all public functions
- Follow existing patterns in the codebase
- Test with pytest

### General

- No commented-out code
- No `console.log` / `print` debugging left in
- Meaningful variable and function names
- Keep functions short and focused

---

## Reporting Bugs

Open an [issue](https://github.com/ub1979/lyra/issues/new) with:

1. **What happened** — describe the bug clearly
2. **What you expected** — what should have happened instead
3. **Steps to reproduce** — minimal steps to trigger the bug
4. **Environment** — OS, Python version, Node version, browser
5. **Logs/Screenshots** — paste any error output

---

## Requesting Features

Open a [Discussion](https://github.com/ub1979/lyra/discussions/new?category=ideas) with:

1. **Problem**: What are you trying to do that you can't?
2. **Proposed solution**: How should it work?
3. **Alternatives considered**: What else did you try?

Feature requests that come with a PR are fast-tracked.

---

## Questions?

- Open a [Discussion](https://github.com/ub1979/lyra/discussions) for general questions
- Tag your issue with `good first issue` if you think it's beginner-friendly

Thank you for making Lyra better!
