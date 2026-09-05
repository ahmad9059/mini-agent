# Mini Agent Skills CLI

> Status: **Planning complete; Phase 1 validation complete.** No application code has been written.
>
> Source request: Command Code take-home exercise supplied in chat on September 5, 2026. The requirements are preserved in `phase-01-validate-spec-and-scope.md`.

---

## 0. How to Read This Plan

This document records the architecture, decisions, risks, and six-phase sequence. Each phase file defines a reviewable implementation slice with exact files and acceptance checks. Work should proceed one phase at a time; a phase is complete only after its checks pass.

## 1. Validated Current State

- The repository contains no implementation, package manifest, tests, or local engineering conventions. Its only tracked project content is the title `# mini-agent` in `README.md:1`.
- The repository is on `main`, tracks `origin/main`, has a clean worktree, and has one commit (`6fbd424 first commit`) as observed during planning.
- There are no existing `docs/plans/`, `AGENTS.md`, or `docs/CONTEXT.md` conventions to preserve. This plan establishes the initial convention.

The external contract was checked against the current official sources:

- The [Agent Skills specification](https://agentskills.io/specification) requires a skill directory with `SKILL.md`, YAML frontmatter, matching `name`, and a non-empty `description`.
- The [client integration guide](https://agentskills.io/client-implementation/adding-skills-support) defines progressive disclosure: disclose metadata, activate a matching skill, then load supporting resources only if needed. It recommends model-driven activation and a constrained activation tool when the model cannot read files directly.
- The [description guidance](https://agentskills.io/skill-creation/optimizing-descriptions) confirms that the description carries the matching responsibility and should be evaluated with positive and negative prompts.
- The official [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) supports Node.js ESM, `ANTHROPIC_API_KEY`, Messages API tool use, and typed API errors.
- The current model catalog identifies `claude-sonnet-5` as the Claude API ID for Sonnet ([models overview](https://platform.claude.com/docs/en/models/overview)).
- The two proposed third-party skills are listed in the skills registry: [doc-coauthoring](https://skills.sh/anthropics/skills/doc-coauthoring) and [brainstorming](https://skills.sh/obra/superpowers/brainstorming).

## 2. Architecture Decisions

### Runtime and project shape

Use plain Node.js ESM rather than TypeScript. The exercise is small, and removing a build step keeps the review focused on the agent loop and skill semantics. Use:

- `@anthropic-ai/sdk` for Claude Messages API calls.
- `yaml` for standards-compliant frontmatter parsing.
- Node's built-in `node:test` and `assert` for tests.
- Node 20 or newer, declared in `package.json`.

### Skill discovery and validation

Discover direct child directories under project-root `.skills/` that contain exactly `SKILL.md`, as required by the assignment's layout. Retain only parsed frontmatter during discovery. Enforce the specification's required fields and name constraints; fail startup with a useful aggregate error rather than silently running with broken bundled skills.

The application stores `name`, `description`, and absolute `location`; it does not retain or send the Markdown body during discovery. It reads and returns the body from `location` during activation. Optional resource execution is out of scope because the selected skills and required demo do not need it.

### Matching and progressive disclosure

Do not implement a regex or keyword classifier. Put the available skill catalog (`name`, `description`) in the system prompt and expose one `activate_skill` client tool whose `name` input is constrained to the discovered skills. Claude decides whether a skill applies.

On a tool call, the harness reads that skill's full body, wraps it with its name and base directory, returns it as a `tool_result`, and continues the Messages API loop. A request unrelated to all skills can end immediately, which means no full skill body is read or sent.

This design directly demonstrates the assignment's likely gotcha: catalog metadata is always available, but `welcome-me` instructions are absent from unrelated prompt context.

### Deliberately narrow agent scope

The CLI is a one-shot prompt-to-response program, not a full autonomous coding environment. It has only the activation tool. Shell execution, file editing, streaming, chat persistence, skill installation, user-level discovery, and arbitrary resource loading would increase risk and obscure the requested behavior.

## 3. Key Design Decisions Requiring Sign-Off

1. **Use plain JavaScript, not TypeScript.** Default: approved for minimal setup and direct readability.
2. **Bundle `doc-coauthoring` and `brainstorming`.** Default: use these registry entries with source attribution and their applicable license files. Both can begin useful conversational workflows with the CLI's text-only capability; avoid skills whose core behavior requires shell or subagent tools.
3. **Use only project `.skills/`.** Default: match the assignment exactly. Supporting `.agents/skills/`, home-directory skills, precedence, and trust policies is deferred because the format specification does not mandate discovery locations.
4. **Use `claude-sonnet-5`.** Default: use the current Sonnet API ID verified during planning. Keep it in one named constant so a model change is a one-line edit.
5. **Strict bundled-skill validation.** Default: malformed bundled skills stop startup with actionable diagnostics. This is simpler and safer than the integration guide's optional lenient compatibility behavior.

## 4. Risk / Backlog Register

| # | Item | Severity | Notes |
|---|---|---|---|
| R1 | Model-driven matching is nondeterministic | Medium | Use precise descriptions, deterministic mocked tool-loop tests, and a small live prompt matrix. |
| R2 | A registry workflow may eventually request unavailable tools | Medium | The chosen skills can start conversationally. Document the text-only limitation and never pretend an unavailable action ran. |
| R3 | Vendored registry content can drift upstream | Low | Record source URL and retrieval date; no runtime download is needed. |
| R4 | API tests can cost money or fail without credentials | Medium | Unit/integration tests use a fake Anthropic client; live smoke tests are opt-in. |
| R5 | Prompt injection inside an untrusted skill | Low for bundled demo | Only bundled project skills are loaded. General project trust policy is out of scope and documented. |
| R6 | Exact welcome header may be lost in generated prose | Medium | Make it the first mandatory instruction and verify with a live smoke test; mocked tests verify content delivery, not model obedience. |

## 5. Phase Map

| Phase | Title | Status |
|---|---|---|
| 1 | Validate Specification and Scope | Complete (planning evidence only) |
| 2 | Scaffold and Discover Skills | Pending |
| 3 | Implement Claude Activation Loop | Pending |
| 4 | Add the Three Skills | Pending |
| 5 | Complete CLI and Failure UX | Pending |
| 6 | Verify, Document, and Prepare Submission | Pending |

## 6. Cross-Cutting Rules

- Keep each phase independently reviewable and avoid speculative abstractions.
- Never retain or send full skill bodies during discovery or catalog construction.
- Never log `ANTHROPIC_API_KEY` or include it in test fixtures.
- Keep model and filesystem dependencies injectable where tests need determinism; do not add a framework for dependency injection.
- Validate with `npm test` and `npm run lint` after every implementation phase that changes JavaScript.
- Preserve upstream skill attribution and licenses.
- Prefer explicit errors over silent fallback when bundled project data is invalid.
- Do not commit generated coverage, local `.env` files, or secrets.

## 7. Next Step

Confirm the defaults in Section 3, then implement Phase 2 only. After its tests pass, review the diff before proceeding to Phase 3.
