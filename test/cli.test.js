import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { stat, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { SKILLS_DIRECTORY, formatCliError, main } from "../src/cli.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

test("joins prompt arguments and prints only the final response", async () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const client = { messages: {} };
  const skills = [{ name: "welcome-me" }];
  let received;

  const exitCode = await main({
    argv: ["  I'm", "new here  "],
    env: { ANTHROPIC_API_KEY: "test-key" },
    stdout,
    stderr,
    discover: async (directory) => {
      assert.equal(directory, SKILLS_DIRECTORY);
      return skills;
    },
    createClient: (apiKey) => {
      assert.equal(apiKey, "test-key");
      return client;
    },
    run: async (options) => {
      received = options;
      return "Final answer";
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(received, { prompt: "I'm new here", skills, client });
  assert.equal(stdout.output, "Final answer\n");
  assert.equal(stderr.output, "");
});

test("missing prompt fails before discovery or client construction", async () => {
  const stderr = captureStream();
  let dependencyCalls = 0;

  const exitCode = await main({
    argv: ["  "],
    env: { ANTHROPIC_API_KEY: "test-key" },
    stdout: captureStream(),
    stderr,
    discover: async () => {
      dependencyCalls += 1;
    },
    createClient: () => {
      dependencyCalls += 1;
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(dependencyCalls, 0);
  assert.equal(stderr.output, "Usage: mini-agent <prompt>\n");
});

test("missing API key fails before discovery or client construction", async () => {
  const stderr = captureStream();
  let dependencyCalls = 0;

  const exitCode = await main({
    argv: ["Hello"],
    env: {},
    stdout: captureStream(),
    stderr,
    discover: async () => {
      dependencyCalls += 1;
    },
    createClient: () => {
      dependencyCalls += 1;
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(dependencyCalls, 0);
  assert.match(stderr.output, /ANTHROPIC_API_KEY is not set/);
});

test("resolves bundled skills independently of the current directory", async () => {
  const originalDirectory = process.cwd();
  let discoveredDirectory;

  try {
    process.chdir(os.tmpdir());
    const exitCode = await main({
      argv: ["Hello"],
      env: { ANTHROPIC_API_KEY: "test-key" },
      stdout: captureStream(),
      stderr: captureStream(),
      discover: async (directory) => {
        discoveredDirectory = directory;
        return [];
      },
      createClient: () => ({ messages: {} }),
      run: async () => "Response",
    });

    assert.equal(exitCode, 0);
    assert.equal(discoveredDirectory, path.join(projectRoot, ".skills"));
  } finally {
    process.chdir(originalDirectory);
  }
});

test("maps Anthropic failures to concise actionable diagnostics", async (t) => {
  const headers = new Headers({ "request-id": "req_test" });
  const cases = [
    [
      "authentication",
      new AuthenticationError(401, {}, "bad secret-key", headers),
      "Authentication failed. Check ANTHROPIC_API_KEY and try again.",
    ],
    [
      "rate limit",
      new RateLimitError(429, {}, "too many requests", headers),
      "Anthropic rate limit exceeded. Wait and try again.",
    ],
    [
      "timeout",
      new APIConnectionTimeoutError(),
      "The Anthropic request timed out. Check your connection and try again.",
    ],
    [
      "connection",
      new APIConnectionError({ message: "socket failed" }),
      "Could not connect to Anthropic. Check your connection and try again.",
    ],
    [
      "generic API status",
      new APIError(418, {}, "teapot", headers),
      "Anthropic API request failed (HTTP 418). Request ID: req_test.",
    ],
  ];

  for (const [name, error, expected] of cases) {
    await t.test(name, () => {
      assert.equal(formatCliError(error), expected);
      assert.doesNotMatch(formatCliError(error), /secret-key|socket failed|teapot/);
    });
  }
});

test("routes runtime errors to stderr and returns a nonzero exit code", async () => {
  const stdout = captureStream();
  const stderr = captureStream();

  const exitCode = await main({
    argv: ["Hello"],
    env: { ANTHROPIC_API_KEY: "test-key" },
    stdout,
    stderr,
    discover: async () => [],
    createClient: () => ({ messages: {} }),
    run: async () => {
      throw new Error("Claude returned no text response");
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.output, "");
  assert.equal(stderr.output, "Error: Claude returned no text response\n");
});

test("emits activated skill names only when debug logging is enabled", async () => {
  const stdout = captureStream();
  const stderr = captureStream();

  const exitCode = await main({
    argv: ["Onboard me"],
    env: { ANTHROPIC_API_KEY: "test-key", DEBUG: "mini-agent" },
    stdout,
    stderr,
    discover: async () => [],
    createClient: () => ({ messages: {} }),
    run: async ({ onSkillActivated }) => {
      onSkillActivated("welcome-me");
      return "Response";
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(stdout.output, "Response\n");
  assert.equal(stderr.output, "[mini-agent] activated skill: welcome-me\n");
});

test("package metadata exposes an executable CLI and one-command start script", async () => {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
  const cliStats = await stat(path.join(projectRoot, "src", "cli.js"));

  assert.equal(packageJson.bin["mini-agent"], "./src/cli.js");
  assert.equal(packageJson.scripts.start, "node src/cli.js");
  assert.notEqual(cliStats.mode & 0o111, 0);
});

test("can be imported when argv contains a synthetic non-file value", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "process.argv[1] = 'not-a-real-file'; await import('./src/cli.js');",
    ],
    { cwd: projectRoot },
  );

  assert.equal(stdout, "");
  assert.equal(stderr, "");
});

function captureStream() {
  return {
    output: "",
    write(chunk) {
      this.output += chunk;
    },
  };
}
