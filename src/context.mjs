import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

export function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function buildAssignment(agent, projectRoot) {
  const sources = [];
  for (const file of agent.sourceFiles) {
    const content = await readFile(join(projectRoot, file), "utf8");
    sources.push({ file, content, sha256: hash(content) });
  }
  const sourceContext = sources.map(({ file, content }) => {
    const numbered = content.trimEnd().split("\n")
      .map((line, index) => `${index + 1}: ${line}`)
      .join("\n");
    return `FILE: ${file}\n${numbered}`;
  }).join("\n\n");

  return {
    agentId: agent.id,
    systemPrompt: agent.systemPrompt,
    task: agent.task,
    sources,
    sourceContext,
    promptHash: hash(agent.systemPrompt),
    sourceContextHash: hash(sourceContext),
    receivesFrom: agent.receivesFrom,
    deliversTo: agent.deliversTo
  };
}
