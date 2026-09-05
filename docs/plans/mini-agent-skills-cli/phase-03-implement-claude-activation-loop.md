# Phase 3 - Implement Claude Activation Loop

Depends on: Phase 2

---

## 1. Goal

Connect the metadata catalog to Claude Sonnet and implement the smallest correct tool-use loop for model-driven skill activation. This phase proves progressive disclosure in code, independent of the final CLI presentation.

## 2. Scope

### In Scope

- Anthropic Messages API integration.
- System prompt with available skill metadata and activation rules.
- A constrained `activate_skill` client tool.
- Tool-result continuation until Claude returns a final answer.
- Activation deduplication and a finite loop limit.
- Deterministic tests with a fake Anthropic client.

### Out of Scope

- Streaming.
- Conversation persistence.
- General filesystem, shell, or editing tools.
- Automatic loading of references, assets, or scripts.
- Final terminal error wording.

## 3. Detailed Tasks / Design

1. Define a single `MODEL = "claude-sonnet-5"` constant and a modest `max_tokens` value appropriate for concise CLI output.
2. Build the system prompt from fixed agent guidance and the metadata-only catalog. Tell Claude to call `activate_skill` when a task matches a description and not to call it for unrelated requests.
3. Define `activate_skill` with a JSON Schema enum populated from discovered skill names. Do not register the tool when no valid skills exist.
4. Implement `runAgent({ prompt, skills, client })`:
   - Send the initial user message.
   - Preserve each full assistant content array in conversation history.
   - For every `activate_skill` block, resolve only a discovered name.
   - Read the selected `SKILL.md`, return its Markdown body and base directory in a structured `tool_result`, and continue.
   - Deduplicate repeated activation by returning a short "already active" result.
   - Stop after a small fixed number of API turns with a clear error.
   - Join final text blocks for the caller.
5. Keep SDK construction outside the core function so tests can supply a fake `client.messages.create`.
6. Test positive, negative, multiple-block, repeated-activation, unknown-name defense, and loop-limit paths.

## 4. Files Touched

- `src/agent.js` (new)
- `src/skills.js`
- `test/agent.test.js` (new)
- `test/fixtures/skills/*`

## 5. Acceptance Criteria / QA Checklist

- [ ] Initial API input contains all skill names/descriptions and no full skill bodies.
- [ ] A simulated `welcome-me` tool call causes only `welcome-me` instructions to appear in the next request.
- [ ] A simulated unrelated response completes after one request and never reads or sends `welcome-me` instructions.
- [ ] Tool results use the exact `tool_use_id` returned by Claude.
- [ ] Final output includes all text content blocks in order and excludes tool blocks.
- [ ] Repeated activation does not duplicate the body in context.
- [ ] The loop fails safely after the configured turn limit.
- [ ] Tests make no network requests.

## 6. Open Questions

None. Keep the manual loop rather than using a beta tool runner so the core protocol is visible to reviewers.
