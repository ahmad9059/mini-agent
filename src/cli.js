#!/usr/bin/env node

import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { config as loadDotenv } from "dotenv";

import { runAgent } from "./agent.js";
import { discoverSkills } from "./skills.js";

const cliFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(cliFile), "..");
export const SKILLS_DIRECTORY = path.join(projectRoot, ".skills");
export const ENV_FILE = path.join(projectRoot, ".env");

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  skillsDirectory = SKILLS_DIRECTORY,
  discover = discoverSkills,
  createClient = (apiKey) => new Anthropic({ apiKey }),
  run = runAgent,
} = {}) {
  const prompt = argv.join(" ").trim();
  if (prompt === "") {
    stderr.write("Usage: mini-agent <prompt>\n");
    return 1;
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    stderr.write(
      "Error: ANTHROPIC_API_KEY is not set. Export it in your environment and try again.\n",
    );
    return 1;
  }

  try {
    const skills = await discover(skillsDirectory);
    const client = createClient(apiKey);
    const debugOptions =
      env.DEBUG === "mini-agent"
        ? {
            onSkillActivated: (name) => {
              stderr.write(`[mini-agent] activated skill: ${name}\n`);
            },
          }
        : {};
    const response = await run({ prompt, skills, client, ...debugOptions });
    stdout.write(`${response}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${formatCliError(error)}\n`);
    return 1;
  }
}

export function formatCliError(error) {
  if (error instanceof AuthenticationError) {
    return "Authentication failed. Check ANTHROPIC_API_KEY and try again.";
  }
  if (error instanceof RateLimitError) {
    return "Anthropic rate limit exceeded. Wait and try again.";
  }
  if (error instanceof APIConnectionTimeoutError) {
    return "The Anthropic request timed out. Check your connection and try again.";
  }
  if (error instanceof APIConnectionError) {
    return "Could not connect to Anthropic. Check your connection and try again.";
  }
  if (error instanceof APIError) {
    const status = error.status ? ` (HTTP ${error.status})` : "";
    const request = error.requestID ? ` Request ID: ${error.requestID}.` : "";
    return `Anthropic API request failed${status}.${request}`;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return "Error: unexpected failure.";
}

export function loadProjectEnvironment({ env = process.env, envFile = ENV_FILE } = {}) {
  const result = loadDotenv({ path: envFile, processEnv: env, quiet: true, override: false });
  if (result.error && result.error.code !== "ENOENT") {
    throw result.error;
  }
}

let isDirectExecution = false;
try {
  isDirectExecution = Boolean(process.argv[1]) && realpathSync(process.argv[1]) === cliFile;
} catch {
  // Importers may use a synthetic argv[1] that is not a filesystem path.
}

if (isDirectExecution) {
  try {
    loadProjectEnvironment();
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`${formatCliError(error)}\n`);
    process.exitCode = 1;
  }
}
