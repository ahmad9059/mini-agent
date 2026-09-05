# Phase 6 - Verify, Document, and Prepare Submission

Depends on: Phase 5

---

## 1. Goal

Verify the full behavior, make the implementation legible to interview reviewers, and complete every requested submission detail with real evidence rather than claims.

## 2. Scope

### In Scope

- Automated test and lint pass.
- Optional live Claude smoke matrix.
- README setup, architecture, examples, limitations, time, and challenges.
- Final dependency and secret hygiene check.
- Completion report after implementation.

### Out of Scope

- CI/CD unless needed to repair an observed portability issue.
- Publishing to npm.
- Production hardening beyond the assignment.
- Expanding the agent's tool set.

## 3. Detailed Tasks / Design

1. Run the full deterministic suite and lint command from a clean install.
2. If a valid API key is available, run these live prompts and record outcomes without saving model responses containing sensitive data:
   - `I'm new to this project, what should I do?`
   - `Help me draft a technical decision document.`
   - `Help me think through a design for a small command-line bookmark manager.`
   - `What's the weather?`
3. Add optional debug observability only if needed for evaluation, for example `DEBUG=mini-agent` logging activated skill names to stderr. Do not include skill bodies or credentials. The default CLI remains clean.
4. Verify the welcome response begins exactly with `> Welcome to our agent!`.
5. Verify the weather prompt does not activate `welcome-me`. Because the CLI has no weather tool, Claude should answer honestly that it lacks live weather data rather than inventing it.
6. Complete `README.md` with:
   - What the project demonstrates.
   - Prerequisites and `ANTHROPIC_API_KEY` setup.
   - Install and single-command run instructions.
   - 2-3 copy-paste prompts.
   - Concise architecture/progressive-disclosure explanation.
   - Testing commands.
   - Actual time spent.
   - Actual challenges and tradeoffs.
   - Known limitations.
   - Registry skill attribution.
7. Inspect tracked files for secrets, accidental `.env`, generated artifacts, and unnecessary dependencies.
8. Generate `COMPLETION-REPORT.md` from the implemented files, test output, and git history only after all work is complete.

## 4. Files Touched

- `README.md`
- `package.json` (only if scripts need final adjustment)
- `src/*` and `test/*` (only for defects found by verification)
- `docs/plans/mini-agent-skills-cli/COMPLETION-REPORT.md` (new after completion)

## 5. Acceptance Criteria / QA Checklist

- [ ] Fresh `npm install` succeeds under the documented Node version.
- [ ] `npm test` passes without credentials or network access.
- [ ] `npm run lint` passes.
- [ ] Live welcome prompt produces the exact required first-line header.
- [ ] Live unrelated prompt does not activate `welcome-me`.
- [ ] Each registry skill activates for one clear matching prompt.
- [ ] README contains the requested time spent, challenges, one command, and 2-3 examples.
- [ ] README accurately explains that metadata is disclosed eagerly while bodies are loaded on demand.
- [ ] No secret, `.env`, debug transcript, or generated coverage is tracked.
- [ ] Final diff remains focused on the assignment.

## 6. Open Questions

- A live smoke run requires the user's `ANTHROPIC_API_KEY`. If unavailable, mark live checks as not run rather than presenting mocked tests as end-to-end proof.
