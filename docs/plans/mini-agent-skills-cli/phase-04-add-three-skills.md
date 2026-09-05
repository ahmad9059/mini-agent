# Phase 4 - Add the Three Skills

Depends on: Phase 3

---

## 1. Goal

Bundle three valid Agent Skills and tune their descriptions and instructions for reliable, non-overlapping selection. This phase delivers the assignment's required `welcome-me` behavior and two traceable registry skills.

## 2. Scope

### In Scope

- Custom `welcome-me` skill.
- Vendored `doc-coauthoring` registry skill.
- Vendored `brainstorming` registry skill.
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
3. Vendor the current `doc-coauthoring` skill from `anthropics/skills` without silently rewriting its process. Preserve its applicable license and source URL.
4. Vendor the current `brainstorming` skill from `obra/superpowers`, preserve its applicable license and source URL, and document that unavailable file-writing or follow-on skill operations must be explained rather than fabricated.
5. Add source metadata using string values allowed by the specification, or a nearby `NOTICE.md` if preserving the upstream file exactly is preferable.
6. Add trigger cases:
   - Welcome positive: "I'm new to this project, what should I do?"
   - Welcome paraphrase: "I just joined and don't know where to start."
   - Welcome negatives: weather question, documentation drafting request, product brainstorming request, simple greeting.
   - One clear positive prompt for each registry skill.
7. Run local validation for all three skill directories.

## 4. Files Touched

- `.skills/welcome-me/SKILL.md` (new)
- `.skills/doc-coauthoring/SKILL.md` (new, vendored)
- `.skills/brainstorming/SKILL.md` (new, vendored)
- `.skills/NOTICE.md` (new)
- `.skills/LICENSES/*` (new, as required by upstream licenses)
- `test/fixtures/trigger-cases.json` (new)
- `test/skills.test.js`

## 5. Acceptance Criteria / QA Checklist

- [ ] Exactly three production skill directories are discovered.
- [ ] Every production skill passes local spec validation.
- [ ] Directory names exactly match frontmatter names.
- [ ] `welcome-me` instructions require the exact quoted header as the first line.
- [ ] Initial catalog construction does not contain that exact header.
- [ ] Both registry skills have verifiable registry/source links and preserved licenses.
- [ ] Trigger cases include positive, paraphrased, unrelated, and near-miss examples.

## 6. Open Questions

- Confirm upstream license requirements at the exact revisions vendored during implementation and preserve the necessary files.
