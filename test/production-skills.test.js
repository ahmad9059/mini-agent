import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { discoverSkills, formatSkillCatalog, readSkillInstructions } from "../src/skills.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDirectory = path.join(projectRoot, ".skills");

test("discovers and validates the three production skills", async () => {
  const skills = await discoverSkills(skillsDirectory);

  assert.deepEqual(
    skills.map(({ name }) => name),
    ["brainstorming", "systematic-debugging", "welcome-me"],
  );

  for (const skill of skills) {
    assert.ok(skill.description.length > 0);
    assert.ok(skill.description.length <= 1024);
    const instructions = await readSkillInstructions(skill.location);
    assert.ok(instructions.body.length > 0);
    assert.equal(instructions.directory, path.dirname(skill.location));
  }
});

test("keeps production instruction bodies out of the initial catalog", async () => {
  const catalog = formatSkillCatalog(await discoverSkills(skillsDirectory));

  assert.match(catalog, /<name>brainstorming<\/name>/);
  assert.match(catalog, /<name>systematic-debugging<\/name>/);
  assert.match(catalog, /<name>welcome-me<\/name>/);
  assert.doesNotMatch(catalog, /Welcome to our agent!/);
  assert.doesNotMatch(catalog, /NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST/);
  assert.doesNotMatch(catalog, /<HARD-GATE>/);
});

test("welcome-me defines the required response prefix", async () => {
  const { body } = await readSkillInstructions(
    path.join(skillsDirectory, "welcome-me", "SKILL.md"),
  );

  assert.match(body, /Your response must begin with this exact line:/);
  assert.match(body, /^> Welcome to our agent!$/m);
});

test("vendored skills match their pinned upstream Git blobs", async () => {
  const expectedHashes = new Map([
    ["brainstorming", "b56a3b5ed6ea0d6216501e0e401ecb00a1b4675f"],
    ["systematic-debugging", "095d194ac041502905f15b01d22d294fb94db8b2"],
  ]);

  for (const [name, expectedHash] of expectedHashes) {
    const contents = await readFile(path.join(skillsDirectory, name, "SKILL.md"));
    assert.equal(gitBlobHash(contents), expectedHash);
  }

  const notice = await readFile(path.join(skillsDirectory, "NOTICE.md"), "utf8");
  assert.match(notice, /b36e0829c6d0140e93cfef2ca599b1b07d4a7797/);
  for (const [name, hash] of expectedHashes) {
    assert.match(notice, new RegExp(`skills\\.sh/obra/superpowers/${name}`));
    assert.match(notice, new RegExp(hash));
  }
});

test("trigger cases cover matches, paraphrases, unrelated prompts, and near misses", async () => {
  const fixture = await readFile(path.join(projectRoot, "test", "fixtures", "trigger-cases.json"));
  const cases = JSON.parse(fixture);
  const installedSkills = new Set(
    (await discoverSkills(skillsDirectory)).map(({ name }) => name),
  );

  assert.equal(cases.length, 7);
  assert.equal(new Set(cases.map(({ category }) => category)).size, cases.length);
  assert.ok(cases.some(({ category }) => category === "welcome-positive"));
  assert.ok(cases.some(({ category }) => category === "welcome-paraphrase"));
  assert.ok(cases.some(({ category }) => category === "unrelated"));
  assert.ok(cases.some(({ category }) => category.endsWith("near-miss")));

  for (const triggerCase of cases) {
    assert.equal(typeof triggerCase.prompt, "string");
    assert.ok(triggerCase.prompt.length > 0);
    assert.ok(
      triggerCase.expectedSkill === null || installedSkills.has(triggerCase.expectedSkill),
      `unknown expected skill in ${triggerCase.category}`,
    );
  }
});

function gitBlobHash(contents) {
  const header = Buffer.from(`blob ${contents.length}\0`);
  return createHash("sha1").update(header).update(contents).digest("hex");
}
