import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SkillValidationError,
  discoverSkills,
  formatSkillCatalog,
  readSkillInstructions,
  readSkillMetadata,
} from "../src/skills.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "skills");

test("discovers valid skills in deterministic order", async () => {
  const skills = await discoverSkills(path.join(fixtures, "valid"));

  assert.deepEqual(
    skills.map(({ name }) => name),
    ["alpha", "zeta"],
  );
  assert.equal(skills[0].description, "Handles alpha requests & explains <special> cases.");
  assert.equal(skills[0].location, path.join(fixtures, "valid", "alpha", "SKILL.md"));
  assert.deepEqual(Object.keys(skills[0]), ["name", "description", "location"]);
});

test("formats a metadata-only XML catalog", async () => {
  const skills = await discoverSkills(path.join(fixtures, "valid"));
  const catalog = formatSkillCatalog(skills);

  assert.match(catalog, /^<available_skills>/);
  assert.match(catalog, /<name>alpha<\/name>/);
  assert.match(catalog, /Handles alpha requests &amp; explains &lt;special&gt; cases\./);
  assert.doesNotMatch(catalog, /ALPHA_PRIVATE_INSTRUCTIONS|ZETA_PRIVATE_INSTRUCTIONS/);
  assert.doesNotMatch(catalog, /<location>/);
  assert.equal(formatSkillCatalog([]), "");
});

test("loads only the instruction body during activation", async () => {
  const skillFile = path.join(fixtures, "valid", "alpha", "SKILL.md");
  const instructions = await readSkillInstructions(skillFile);

  assert.equal(instructions.directory, path.dirname(skillFile));
  assert.match(instructions.body, /^# Alpha instructions/);
  assert.match(instructions.body, /ALPHA_PRIVATE_INSTRUCTIONS/);
  assert.doesNotMatch(instructions.body, /name: alpha|description:/);
});

test("reports malformed and invalid fixture files with their paths", async (t) => {
  const cases = [
    ["missing-frontmatter", /must start with YAML frontmatter/],
    ["malformed-yaml", /invalid YAML frontmatter/],
    ["missing-name", /name must be a non-empty string/],
    ["Bad-Name", /only lowercase letters, numbers, and single hyphens/],
    ["directory-mismatch", /must match directory/],
  ];

  for (const [directory, expectedMessage] of cases) {
    await t.test(directory, async () => {
      const skillFile = path.join(fixtures, "invalid", directory, "SKILL.md");
      await assert.rejects(
        readSkillMetadata(skillFile),
        (error) =>
          error instanceof SkillValidationError &&
          error.message.includes(skillFile) &&
          expectedMessage.test(error.message),
      );
    });
  }
});

test("validates field lengths, optional field types, metadata, and unknown fields", async (t) => {
  const cases = [
    ["description", "x".repeat(1025), /description must be at most 1024 characters/],
    ["compatibility", "x".repeat(501), /compatibility must be at most 500 characters/],
    ["license", ["MIT"], /license must be a string/],
    ["metadata", { version: 1 }, /metadata values must be strings/],
    ["custom-field", true, /unexpected frontmatter fields: custom-field/],
  ];

  for (const [field, value, expectedMessage] of cases) {
    await t.test(field, async () => {
      await withTemporarySkill({ [field]: value }, async (skillFile) => {
        await assert.rejects(readSkillMetadata(skillFile), expectedMessage);
      });
    });
  }
});

test("aggregates validation errors across discovered skills", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mini-agent-skills-"));

  try {
    await writeSkill(root, "missing-description", { name: "missing-description" });
    await writeSkill(root, "unknown-field", {
      name: "unknown-field",
      description: "Invalid extra field.",
      extra: true,
    });

    await assert.rejects(
      discoverSkills(root),
      (error) =>
        error instanceof SkillValidationError &&
        error.problems.length === 2 &&
        error.message.includes("missing-description") &&
        error.message.includes("unknown-field"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function withTemporarySkill(overrides, assertion) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mini-agent-skill-"));

  try {
    const skillFile = await writeSkill(root, "test-skill", {
      name: "test-skill",
      description: "A valid test skill.",
      ...overrides,
    });
    await assertion(skillFile);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeSkill(root, directory, metadata) {
  const skillDirectory = path.join(root, directory);
  await mkdir(skillDirectory, { recursive: true });
  const skillFile = path.join(skillDirectory, "SKILL.md");
  const frontmatter = Object.entries(metadata)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  await writeFile(skillFile, `---\n${frontmatter}\n---\n\nInstructions.\n`);
  return skillFile;
}
