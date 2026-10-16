import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { agents } from "../src/agents.mjs";
import { buildAssignment } from "../src/context.mjs";

const assignments = await Promise.all(
  agents.map(agent => buildAssignment(agent, resolve("fixtures/demo")))
);
assert.equal(new Set(assignments.map(a => a.agentId)).size, 3);
assert.equal(new Set(assignments.map(a => a.promptHash)).size, 3);
assert.equal(new Set(assignments.map(a => a.sourceContextHash)).size, 3,
  "Agents unexpectedly received identical source contexts.");
const completed = new Set();
for (const assignment of assignments) {
  assert.ok(assignment.sourceContext.length > 0);
  for (const dependency of assignment.receivesFrom) {
    assert.ok(completed.has(dependency),
      `${assignment.agentId} has invalid dependency: ${dependency}`);
  }
  completed.add(assignment.agentId);
}
for (const assignment of assignments) {
  if (!assignment.deliversTo) continue;
  const receiver = assignments.find(a => a.agentId === assignment.deliversTo);
  assert.ok(receiver?.receivesFrom.includes(assignment.agentId));
}
const output = resolve("runs", `context-check-${Date.now()}`);
await mkdir(output, { recursive: true });
for (const assignment of assignments) {
  await writeFile(join(output, `${assignment.agentId}.json`),
    JSON.stringify(assignment, null, 2) + "\n");
}
console.table(assignments.map(a => ({
  agent: a.agentId,
  files: a.sources.map(s => s.file).join(", "),
  receives: a.receivesFrom.join(", ") || "(initial task)",
  promptHash: a.promptHash.slice(0, 12),
  contextHash: a.sourceContextHash.slice(0, 12)
})));
console.log("PASS: Three distinct prompts and source contexts.");
console.log("PASS: Handoff configuration and dependency order are valid.");
console.log(`Full assignments saved to: ${output}`);
console.log("No models called. Agent collaboration has not yet been executed.");
