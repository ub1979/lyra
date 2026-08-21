# Changelog

What changed in each release of Lyra, newest first. The top entry's version must
match `LYRA_VERSION` in `lyra_version.py` — a test enforces it, so bumping one
without the other fails the build rather than shipping a lie.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions are `MAJOR.MINOR.PATCH` on the `alpha` channel until the interface stops
moving under users.

## [Unreleased]

_Nothing yet. Add entries here as work lands; move them under a version heading
when you cut the release._

## [0.17.0] - 2026-08-21 — base code

- Base code. This is the baseline every later release is measured against:
  guided chat, the agent roster and its playbooks, the skills library, and the
  dashboard as they stand today.
- Versioning starts here — from now on every release records what changed and
  why, and the running version is visible in the app.
