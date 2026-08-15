# ADR 0004 — Deploy TepuQ Kata via the Existing tepuq.pages.dev Pipeline

**Status:** Accepted

**Date:** 2026-08-15

## Context
ADR 0002 folds TepuQ Kata into the TepuQ repo as a second game on the same main page. TepuQ already ships to Cloudflare Pages via a GitHub Actions workflow on push to `main`: it runs unit tests, builds, provisions the `TEPUQ_SYNC` KV namespace, sets Pages secrets, and deploys `dist/` to the `tepuq` Pages project. A second workflow runs Playwright smoke tests against `https://tepuq.pages.dev` after every successful deploy and opens a GitHub issue on failure. All required repo secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TEPUQ_JWT_SECRET`, `TEPUQ_PASS`, `TEPUQ_USER`) are already set on `ahaqqu/TepuQ`. The original TariQ repo has none of these.

Because Kata now shares a deploy with the live Gambar app, a broken Kata could take down the working Gambar site on the same build.

We considered three deploy targets:
1. Deploy to the existing `tepuq.pages.dev` on push to `main`, reusing all secrets. (Chosen.)
2. A second Cloudflare Pages project (`tepuq-kata`) with its own workflow and secret.
3. Branch-preview deploys, verified before merging to `main`.

## Decision
Ship Kata through the **existing** `tepuq.pages.dev` pipeline. Push to `main` on `ahaqqu/TepuQ` runs the established Action; both games deploy in one build to one Pages project and one URL.

- No new Cloudflare Pages project, no new repo secrets, no new workflow for deployment.
- Production verification uses the existing post-deploy smoke workflow **plus** an additional Playwright smoke that exercises Kata specifically: pick TepuQ Kata from the Game Picker and complete one word on `https://tepuq.pages.dev`.
- Before any push to `main`, the full test suite (Gambar + Kata unit tests and E2E) must pass locally so a Kata regression cannot take down the live Gambar app.

## Rationale
- **One app, one deploy, one URL.** ADR 0002 committed to a single shell; a second Pages project would re-split the family's URL and contradict that.
- **Secrets already exist.** The TepuQ repo has every secret the workflow needs; the TariQ repo has none. Reusing the TepuQ pipeline needs zero new credentials.
- **Smoke verification already wired.** The post-deploy Playwright smoke + auto-issue-on-failure is the prod-verification mechanism; adding a Kata-specific assertion extends it rather than reinventing it.
- **Risk contained by tests.** Keeping Gambar's code and data in untouched stores/folders, and requiring the whole suite to pass before push, is the guard against a Kata bug affecting Gambar.

## Consequences
- **Positive:**
  - No new infrastructure, credentials, or workflow to maintain.
  - One live URL for the whole family app; the existing smoke + issue-on-failure covers prod.
  - A Kata-specific smoke assertion gives direct evidence that Kata works in prod.

- **Negative:**
  - Kata and Gambar share a deploy: a broken main build takes down both games. Mitigated by running the full suite before push and by the post-deploy smoke opening an issue immediately.
  - The prod smoke must grow a Kata path; a Kata-only regression that the Gambar smoke would miss is now possible, so the Kata smoke assertion is mandatory, not optional.
  - `CLOUDFLARE_PROJECT_NAME` is unset, so the workflow defaults to `tepuq`; renaming the project later would require adding that secret.

## Related
- ADR 0002 — TepuQ as a Multi-Game Shell.
- ADR 0003 — Kata data stores and sync scope.
- `.github/workflows/deploy.yml`, `.github/workflows/deploy-smoke.yml`.