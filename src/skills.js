import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

const SKILL_FILE_NAME = "SKILL.md";
const ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

export class SkillValidationError extends Error {
  constructor(problems) {
    super(`Invalid Agent Skills:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    this.name = "SkillValidationError";
    this.problems = problems;
  }
}

export async function discoverSkills(skillsDirectory) {
  const directory = path.resolve(skillsDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const skillDirectories = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  const skills = [];
  const problems = [];

  for (const entry of skillDirectories) {
    const location = path.join(directory, entry.name, SKILL_FILE_NAME);

    try {
      skills.push(await readSkillMetadata(location));
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }

      if (error instanceof SkillValidationError) {
        problems.push(...error.problems);
        continue;
      }

      throw error;
    }
  }

  if (problems.length > 0) {
    throw new SkillValidationError(problems);
  }

  return skills;
}

export async function readSkillMetadata(skillFile) {
  const location = path.resolve(skillFile);
  const content = await readFile(location, "utf8");

  let metadata;
  try {
    metadata = parseFrontmatter(content);
  } catch (error) {
    throw new SkillValidationError([`${location}: ${error.message}`]);
  }

  const problems = validateMetadata(metadata, path.basename(path.dirname(location)));
  if (problems.length > 0) {
    throw new SkillValidationError(problems.map((problem) => `${location}: ${problem}`));
  }

  return {
    name: metadata.name.trim(),
    description: metadata.description.trim(),
    location,
  };
}

export function formatSkillCatalog(skills) {
  if (skills.length === 0) {
    return "";
  }

  const entries = skills.map(
    ({ name, description }) =>
      `  <skill>\n    <name>${escapeXml(name)}</name>\n    <description>${escapeXml(description)}</description>\n  </skill>`,
  );

  return `<available_skills>\n${entries.join("\n")}\n</available_skills>`;
}

function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) {
    throw new Error("SKILL.md must start with YAML frontmatter enclosed by --- lines");
  }

  let metadata;
  try {
    metadata = parse(match[1]);
  } catch (error) {
    throw new Error(`invalid YAML frontmatter: ${error.message}`);
  }

  if (!isPlainObject(metadata)) {
    throw new Error("frontmatter must be a YAML mapping");
  }

  return metadata;
}

function validateMetadata(metadata, directoryName) {
  const problems = [];
  const unknownFields = Object.keys(metadata).filter((field) => !ALLOWED_FIELDS.has(field));

  if (unknownFields.length > 0) {
    problems.push(`unexpected frontmatter fields: ${unknownFields.sort().join(", ")}`);
  }

  if (typeof metadata.name !== "string" || metadata.name.trim() === "") {
    problems.push("name must be a non-empty string");
  } else {
    const name = metadata.name.trim();
    if (name.length > 64) {
      problems.push("name must be at most 64 characters");
    }
    if (!/^(?!.*--)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      problems.push("name must contain only lowercase letters, numbers, and single hyphens");
    }
    if (name !== directoryName) {
      problems.push(`name "${name}" must match directory "${directoryName}"`);
    }
  }

  validateRequiredString(metadata, "description", 1024, problems);
  validateOptionalString(metadata, "license", problems);
  validateOptionalString(metadata, "allowed-tools", problems);
  validateOptionalString(metadata, "compatibility", problems, 500, true);
  validateOptionalMetadata(metadata.metadata, problems);

  return problems;
}

function validateRequiredString(metadata, field, maximumLength, problems) {
  const value = metadata[field];
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`${field} must be a non-empty string`);
    return;
  }

  if (value.length > maximumLength) {
    problems.push(`${field} must be at most ${maximumLength} characters`);
  }
}

function validateOptionalString(metadata, field, problems, maximumLength, requireNonEmpty = false) {
  if (!(field in metadata)) {
    return;
  }

  const value = metadata[field];
  if (typeof value !== "string") {
    problems.push(`${field} must be a string`);
    return;
  }

  if (requireNonEmpty && value.trim() === "") {
    problems.push(`${field} must be a non-empty string`);
  }
  if (maximumLength && value.length > maximumLength) {
    problems.push(`${field} must be at most ${maximumLength} characters`);
  }
}

function validateOptionalMetadata(metadata, problems) {
  if (metadata === undefined) {
    return;
  }
  if (!isPlainObject(metadata)) {
    problems.push("metadata must be a mapping of string keys to string values");
    return;
  }
  if (Object.values(metadata).some((value) => typeof value !== "string")) {
    problems.push("metadata values must be strings");
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
