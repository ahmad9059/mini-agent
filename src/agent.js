import { formatSkillCatalog, readSkillInstructions } from "./skills.js";

export const MODEL = "claude-sonnet-5";

const MAX_TOKENS = 2_048;
const DEFAULT_MAX_TURNS = 5;
const ACTIVATE_SKILL_TOOL = "activate_skill";
const WELCOME_HEADER = "> Welcome to our agent!";

export async function runAgent({
  prompt,
  skills,
  client,
  maxTurns = DEFAULT_MAX_TURNS,
  loadSkill = readSkillInstructions,
  onSkillActivated = () => {},
}) {
  const messages = [{ role: "user", content: prompt }];
  const activeSkills = new Set();
  const skillsByName = new Map(skills.map((skill) => [skill.name, skill]));
  const tools = buildTools(skills);

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(skills),
      messages,
      ...(tools.length > 0 ? { tools } : {}),
    });
    const toolUses = response.content.filter((block) => block.type === "tool_use");

    if (toolUses.length === 0) {
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      if (text === "") {
        throw new Error("Claude returned no text response");
      }

      return activeSkills.has("welcome-me") ? ensureWelcomeHeader(text) : text;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const toolUse of toolUses) {
      toolResults.push(
        await activateSkill({
          toolUse,
          skillsByName,
          activeSkills,
          loadSkill,
          onSkillActivated,
        }),
      );
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Claude did not finish after ${maxTurns} turns`);
}

export function buildSystemPrompt(skills) {
  const catalog = formatSkillCatalog(skills);
  const basePrompt = "You are a concise coding assistant. Answer the user's request directly.";

  if (catalog === "") {
    return basePrompt;
  }

  return `${basePrompt}

The following skills provide specialized instructions for specific tasks.
When the user's request matches a skill description, call activate_skill before answering.
Do not activate a skill for an unrelated request. After activation, follow the returned instructions.

${catalog}`;
}

function buildTools(skills) {
  if (skills.length === 0) {
    return [];
  }

  return [
    {
      name: ACTIVATE_SKILL_TOOL,
      description:
        "Loads the full instructions for one available skill. Use it before answering when the user's request matches a skill description. Do not use it for unrelated requests, and do not invent skill names.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: skills.map((skill) => skill.name),
            description: "The exact name of the relevant available skill.",
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  ];
}

async function activateSkill({
  toolUse,
  skillsByName,
  activeSkills,
  loadSkill,
  onSkillActivated,
}) {
  if (toolUse.name !== ACTIVATE_SKILL_TOOL) {
    return toolError(toolUse.id, `Unknown tool: ${toolUse.name}`);
  }

  const name = toolUse.input?.name;
  const skill = typeof name === "string" ? skillsByName.get(name) : undefined;
  if (!skill) {
    return toolError(toolUse.id, `Unknown skill: ${String(name)}`);
  }

  if (activeSkills.has(name)) {
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: `Skill "${name}" is already active. Continue using its instructions.`,
    };
  }

  const { body, directory } = await loadSkill(skill.location);
  activeSkills.add(name);
  onSkillActivated(name);

  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: `<skill_content name="${escapeXmlAttribute(name)}">
${body}

Skill directory: ${directory}
Relative paths in this skill are relative to the skill directory.
</skill_content>`,
  };
}

function toolError(toolUseId, message) {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: message,
    is_error: true,
  };
}

function escapeXmlAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function ensureWelcomeHeader(text) {
  if (text.startsWith(WELCOME_HEADER)) {
    return text;
  }

  const body = text.replace(/^Welcome to our agent!\s*/i, "");
  return body === "" ? WELCOME_HEADER : `${WELCOME_HEADER}\n\n${body}`;
}
