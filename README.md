# mini-agent

A small Node.js CLI that demonstrates model-driven [Agent Skills](https://agentskills.io/) matching with Claude Sonnet. It discovers project skills, exposes only their metadata initially, and loads a full `SKILL.md` body only after Claude activates that skill.

## Requirements

- Node.js 20 or newer
- An Anthropic API key

## Setup

```bash
npm install
```

Add the key to the ignored project-root `.env` file:

```dotenv
ANTHROPIC_API_KEY=your-api-key
```

The CLI loads this file automatically and never prints the key. An `ANTHROPIC_API_KEY` already exported in the shell takes precedence over `.env`. The committed `.env.example` documents the expected variable without containing a credential.

## Run

```bash
npm start -- "I'm new to this project, what should I do?"
```

The command accepts quoted or unquoted multi-word prompts. Successful responses are written to stdout; usage and API errors are written to stderr with a nonzero exit code.

## Example Prompts

```text
I'm new to this project, what should I do?
```

```text
Help me think through a design for a small command-line bookmark manager.
```

```text
The tests started failing with a TypeError after my last change. Help me find the root cause.
```

## How It Works

1. `src/skills.js` discovers direct children of `.skills/`, validates Agent Skills frontmatter, and retains only each skill's name, description, and file location.
2. `src/agent.js` sends the metadata-only catalog to `claude-sonnet-5` and exposes a constrained `activate_skill` tool.
3. Claude decides whether a description matches the user's intent. There is no keyword router.
4. When Claude activates a known skill, the harness reads that skill's full Markdown body, returns it as a tool result, and continues the Messages API loop.
5. Unrelated requests can complete without reading or sending any skill body.

This is progressive disclosure: lightweight metadata is eager, while full instructions are loaded on demand. The harness also guarantees the assignment's exact `> Welcome to our agent!` first line after `welcome-me` activation because model formatting alone is not byte-stable.

Set `DEBUG=mini-agent` to print activated skill names to stderr without exposing skill bodies or credentials:

```bash
DEBUG=mini-agent npm start -- "Help me diagnose a failing test."
```

## Included Skills

- `welcome-me`: custom onboarding guidance for users who are new to the repository.
- [`brainstorming`](https://skills.sh/obra/superpowers/brainstorming): design-first exploration for creative work.
- [`systematic-debugging`](https://skills.sh/obra/superpowers/systematic-debugging): root-cause-first debugging workflow.

The registry skills are vendored byte-for-byte from `obra/superpowers` commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`. Source hashes and retrieval details are in `.skills/NOTICE.md`; the upstream MIT license is preserved in `.skills/LICENSES/obra-superpowers-MIT.txt`.

## Tests

Tests use an injected fake Anthropic client, so they require neither credentials nor network access.

```bash
npm test
npm run lint
```

The suite covers skill validation, metadata-only disclosure, activation tool turns, duplicate and unknown activations, exact vendor hashes, CLI output and exit behavior, SDK error mapping, and working-directory independence.

## Verification

The final implementation passed 45 deterministic tests on Node.js 20 and the development Node version. A live Claude smoke matrix confirmed:

- The onboarding prompt activated `welcome-me` and produced the exact required first line.
- The design prompt activated `brainstorming`.
- The failing-test prompt activated `systematic-debugging`.
- An unrelated weather prompt activated no skill and did not claim access to live weather.

## Time Spent

Approximately 12 hours in total, including specification research, planning, implementation, automated testing, live Claude verification, and documentation.

## Challenges and Tradeoffs

- Model-driven matching demonstrates the specification more faithfully than keyword matching, but live selection remains nondeterministic. Precise descriptions, deterministic tool-loop tests, and a live smoke matrix mitigate this.
- Claude omitted the literal Markdown quote marker from the required welcome header during the first live check. The harness now enforces that first line only after `welcome-me` has actually activated.
- The initially considered `doc-coauthoring` skill did not have a clear repository or skill-local license at the inspected revision. It was replaced with `systematic-debugging`; both selected registry skills now share a pinned, preserved MIT license.
- Preserving registry skills byte-for-byte retains references to tools and companion files that this minimal CLI does not provide. The agent must explain those limitations rather than claim an unavailable operation ran.

## Limitations

- One prompt and one final response per process; there is no interactive session or conversation persistence.
- The only client tool is `activate_skill`. There is no shell, file editing, browser, subagent, streaming, or arbitrary skill-resource loader.
- The CLI loads only the project-root `.env`; it does not search parent directories or support alternate environment-file flags.
- Matching depends on Claude's judgment and may vary across model revisions.
- Interrupts use Node's default SIGINT behavior rather than a custom graceful-cancellation flow.
