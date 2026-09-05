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

import { runAgent } from "./agent.js";
import { discoverSkills } from "./skills.js";

const cliFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(cliFile), "..");
export const SKILLS_DIRECTORY = path.join(projectRoot, ".skills");

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
    const response = await run({ prompt, skills, client });
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

if (process.argv[1] && realpathSync(process.argv[1]) === cliFile) {
  process.exitCode = await main();
}
