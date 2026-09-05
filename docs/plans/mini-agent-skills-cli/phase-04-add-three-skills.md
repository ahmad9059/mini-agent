# Phase 4 - Add the Three Skills

Depends on: Phase 3

Status: **Complete.** Three production skills, pinned attribution, static validation, and trigger fixtures are implemented and verified.

---

## 1. Goal

Bundle three valid Agent Skills and tune their descriptions and instructions for reliable, non-overlapping selection. This phase delivers the assignment's required `welcome-me` behavior and two traceable registry skills.

## 2. Scope

### In Scope

- Custom `welcome-me` skill.
- Vendored `brainstorming` registry skill.
- Vendored `systematic-debugging` registry skill.
- Source and license attribution.
- Positive and near-miss trigger fixtures.
- Static specification validation.

### Out of Scope

- Runtime registry downloads.
- Modifying upstream skill workflows to imply unsupported tools.
- Executing skill scripts or references.
- Broad description optimization using dozens of paid calls.

## 3. Detailed Tasks / Design

1. Create `.skills/welcome-me/SKILL.md` with valid frontmatter. Its description should explicitly target:
   - New contributors or users.
   - Unfamiliarity with the current repository.
   - Requests for setup, orientation, first steps, or where to begin.
   - It should not target general greetings or unrelated questions.
2. Make the first body instruction require the exact first output line `> Welcome to our agent!`. Follow it with a concise onboarding checklist that does not invent repository facts.
3. Vendor `brainstorming` and `systematic-debugging` from `obra/superpowers` at commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` without rewriting their workflows. Preserve their MIT license, source URLs, and Git blob hashes.
4. Record that unavailable file-writing, shell, visual-companion, or follow-on skill operations must be explained rather than fabricated.
5. Add source metadata using string values allowed by the specification, or a nearby `NOTICE.md` if preserving the upstream file exactly is preferable.
6. Add trigger cases:
   - Welcome positive: "I'm new to this project, what should I do?"
   - Welcome paraphrase: "I just joined and don't know where to start."
   - Welcome negatives: weather question and simple greeting.
   - Near miss: a conceptual stack-trace question that does not ask for debugging.
   - One clear positive prompt for each registry skill.
7. Run local validation for all three skill directories.

## 4. Files Touched

- `.skills/welcome-me/SKILL.md` (new)
- `.skills/brainstorming/SKILL.md` (new, vendored)
- `.skills/systematic-debugging/SKILL.md` (new, vendored)
- `.skills/NOTICE.md` (new)
- `.skills/LICENSES/*` (new, as required by upstream licenses)
- `test/fixtures/trigger-cases.json` (new)
- `test/production-skills.test.js` (new)

## 5. Acceptance Criteria / QA Checklist

- [x] Exactly three production skill directories are discovered.
- [x] Every production skill passes local spec validation.
- [x] Directory names exactly match frontmatter names.
- [x] `welcome-me` instructions require the exact quoted header as the first line.
- [x] Initial catalog construction does not contain that exact header.
- [x] Both registry skills have verifiable registry/source links, pinned Git blob hashes, and a preserved MIT license.
- [x] Trigger cases include positive, paraphrased, unrelated, and near-miss examples.

## 6. Open Questions

- Resolved: both registry skills are pinned to `obra/superpowers` commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`; its MIT license is preserved in `.skills/LICENSES/obra-superpowers-MIT.txt`.
