import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { MODEL, buildSystemPrompt, runAgent } from "../src/agent.js";

const welcomeSkill = {
  name: "welcome-me",
  description: "Use when someone is new to a project and asks where to begin.",
  location: "/project/.skills/welcome-me/SKILL.md",
};
const docsSkill = {
  name: "documentation",
  description: "Use when someone wants to draft project documentation.",
  location: "/project/.skills/documentation/SKILL.md",
};

test("activates a matching skill and continues with the exact tool use id", async () => {
  const client = fakeClient([
    toolResponse("toolu_welcome", "welcome-me"),
    textResponse("Welcome response"),
  ]);
  const loaded = [];

  const result = await runAgent({
    prompt: "I am new here. What should I do?",
    skills: [welcomeSkill, docsSkill],
    client,
    loadSkill: async (location) => {
      loaded.push(location);
      return {
        body: "WELCOME_PRIVATE_INSTRUCTIONS",
        directory: path.dirname(location),
      };
    },
  });

  assert.equal(result, "Welcome response");
  assert.deepEqual(loaded, [welcomeSkill.location]);
  assert.equal(client.calls.length, 2);

  const initialRequest = client.calls[0];
  assert.equal(initialRequest.model, MODEL);
  assert.match(initialRequest.system, /<name>welcome-me<\/name>/);
  assert.match(initialRequest.system, /<name>documentation<\/name>/);
  assert.doesNotMatch(initialRequest.system, /WELCOME_PRIVATE_INSTRUCTIONS/);
  assert.deepEqual(initialRequest.tools[0].input_schema.properties.name.enum, [
    "welcome-me",
    "documentation",
  ]);

  const continuation = client.calls[1];
  assert.deepEqual(continuation.messages[1].content, client.responses[0].content);
  assert.equal(continuation.messages[2].content[0].tool_use_id, "toolu_welcome");
  assert.match(continuation.messages[2].content[0].content, /WELCOME_PRIVATE_INSTRUCTIONS/);
  assert.doesNotMatch(continuation.messages[2].content[0].content, /documentation/);
});

test("answers an unrelated request without loading a skill", async () => {
  const client = fakeClient([textResponse("I do not have live weather data.")]);
  let loadCount = 0;

  const result = await runAgent({
    prompt: "What is the weather?",
    skills: [welcomeSkill],
    client,
    loadSkill: async () => {
      loadCount += 1;
      throw new Error("should not load");
    },
  });

  assert.equal(result, "I do not have live weather data.");
  assert.equal(loadCount, 0);
  assert.equal(client.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(client.calls[0]), /WELCOME_PRIVATE_INSTRUCTIONS/);
});

test("handles multiple activations from one response", async () => {
  const client = fakeClient([
    {
      content: [
        activationBlock("toolu_welcome", "welcome-me"),
        activationBlock("toolu_docs", "documentation"),
      ],
    },
    textResponse("Both skills loaded"),
  ]);

  await runAgent({
    prompt: "Onboard me and help draft the guide.",
    skills: [welcomeSkill, docsSkill],
    client,
    loadSkill: async (location) => ({
      body: `Instructions from ${location}`,
      directory: path.dirname(location),
    }),
  });

  const results = client.calls[1].messages[2].content;
  assert.deepEqual(
    results.map(({ tool_use_id: id }) => id),
    ["toolu_welcome", "toolu_docs"],
  );
  assert.match(results[0].content, /welcome-me/);
  assert.match(results[1].content, /documentation/);
});

test("does not load the same skill twice", async () => {
  const client = fakeClient([
    toolResponse("toolu_first", "welcome-me"),
    toolResponse("toolu_second", "welcome-me"),
    textResponse("Finished"),
  ]);
  let loadCount = 0;

  await runAgent({
    prompt: "Onboard me.",
    skills: [welcomeSkill],
    client,
    loadSkill: async () => {
      loadCount += 1;
      return { body: "WELCOME_PRIVATE_INSTRUCTIONS", directory: "/project/.skills/welcome-me" };
    },
  });

  assert.equal(loadCount, 1);
  const repeatedResult = client.calls[2].messages[4].content[0];
  assert.equal(repeatedResult.tool_use_id, "toolu_second");
  assert.match(repeatedResult.content, /already active/);
  assert.doesNotMatch(repeatedResult.content, /WELCOME_PRIVATE_INSTRUCTIONS/);
});

test("returns tool errors for unknown names instead of reading arbitrary files", async () => {
  const client = fakeClient([
    toolResponse("toolu_unknown", "not-installed"),
    textResponse("Could not load that skill"),
  ]);
  let loadCount = 0;

  const result = await runAgent({
    prompt: "Use a missing skill.",
    skills: [welcomeSkill],
    client,
    loadSkill: async () => {
      loadCount += 1;
    },
  });

  assert.equal(result, "Could not load that skill");
  assert.equal(loadCount, 0);
  assert.deepEqual(client.calls[1].messages[2].content[0], {
    type: "tool_result",
    tool_use_id: "toolu_unknown",
    content: "Unknown skill: not-installed",
    is_error: true,
  });
});

test("joins final text blocks and ignores non-text blocks", async () => {
  const client = fakeClient([
    {
      content: [
        { type: "thinking", thinking: "Internal reasoning", signature: "signature" },
        { type: "text", text: "First" },
        { type: "text", text: "Second" },
      ],
    },
  ]);

  const result = await runAgent({ prompt: "Answer.", skills: [], client });

  assert.equal(result, "First\nSecond");
  assert.equal("tools" in client.calls[0], false);
  assert.doesNotMatch(client.calls[0].system, /available_skills|activate_skill/);
  assert.equal(buildSystemPrompt([]), "You are a concise coding assistant. Answer the user's request directly.");
});

test("fails safely when Claude keeps requesting tools", async () => {
  const client = fakeClient([
    toolResponse("toolu_first", "welcome-me"),
    toolResponse("toolu_second", "welcome-me"),
  ]);

  await assert.rejects(
    runAgent({
      prompt: "Onboard me.",
      skills: [welcomeSkill],
      client,
      maxTurns: 2,
      loadSkill: async () => ({ body: "Instructions", directory: "/skills/welcome-me" }),
    }),
    /did not finish after 2 turns/,
  );
  assert.equal(client.calls.length, 2);
});

function fakeClient(responses) {
  let responseIndex = 0;
  const calls = [];

  return {
    calls,
    responses,
    messages: {
      create: async (request) => {
        calls.push(structuredClone(request));
        const response = responses[responseIndex];
        responseIndex += 1;
        if (!response) {
          throw new Error("Fake client has no response configured");
        }
        return structuredClone(response);
      },
    },
  };
}

function toolResponse(id, name) {
  return { content: [activationBlock(id, name)] };
}

function activationBlock(id, name) {
  return { type: "tool_use", id, name: "activate_skill", input: { name } };
}

function textResponse(text) {
  return { content: [{ type: "text", text }] };
}
