# Phase 5 - Complete CLI and Failure UX

Depends on: Phase 4

---

## 1. Goal

Turn the tested agent core into a polished one-shot command that is easy for reviewers to run and fails clearly when input, credentials, skills, or the Anthropic API are invalid.

## 2. Scope

### In Scope

- Executable CLI entrypoint.
- Prompt parsing from command-line arguments.
- Environment and startup validation.
- Concise stdout/stderr behavior and exit codes.
- Anthropic error mapping.
- CLI-level tests without real network calls where practical.

### Out of Scope

- Interactive REPL.
- `.env` auto-loading.
- Streaming or spinners.
- Rich terminal UI.
- Provider/model configuration flags.

## 3. Detailed Tasks / Design

1. Add a shebang to `src/cli.js` and expose it through `package.json` scripts and `bin`.
2. Accept the complete prompt from `process.argv.slice(2).join(" ").trim()` so quoted and unquoted multi-word input behaves naturally.
3. Print a one-line usage message and exit nonzero when no prompt is supplied.
4. Check `ANTHROPIC_API_KEY` before constructing the client. Explain how to set it without printing its value.
5. Resolve `.skills/` relative to the package/project root rather than the caller's current working directory, so the documented command is reliable.
6. Discover and validate skills before making an API request.
7. Print only Claude's final text to stdout. Send diagnostics to stderr and set `process.exitCode = 1` on failure.
8. Map common SDK failures into short actionable messages:
   - Authentication.
   - Rate limit.
   - Connection/timeout.
   - Generic API status.
   Preserve enough detail for debugging without dumping request internals.
9. Handle SIGINT through the SDK request signal if the implementation remains simple; otherwise allow Node's default interrupt behavior and document it.

## 4. Files Touched

- `src/cli.js` (new)
- `src/agent.js`
- `package.json`
- `test/cli.test.js` (new)

## 5. Acceptance Criteria / QA Checklist

- [ ] `npm start -- "I'm new to this project, what should I do?"` is the single documented run command.
- [ ] Missing prompt and missing API key fail before any network call.
- [ ] Final responses go to stdout without debug noise.
- [ ] Errors go to stderr and return a nonzero exit code.
- [ ] Running from a different current directory still discovers the bundled skills.
- [ ] Authentication, rate-limit, and connection failures produce actionable messages.
- [ ] CLI tests remain credential-free and deterministic.

## 6. Open Questions

None. Avoid optional flags unless implementation reveals a concrete need.
