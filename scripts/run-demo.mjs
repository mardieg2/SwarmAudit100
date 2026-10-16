import assert from "node:assert/strict";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { agents } from "../src/agents.mjs";
import { buildAssignment, hash } from "../src/context.mjs";
import { callModel, extractText } from "../src/model.mjs";
import { collectVerification } from "../src/verification.mjs";

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("Set OPENAI_API_KEY before running.");
  }
  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) throw new Error("Set OPENAI_MODEL to an API model ID.");

  const directory = resolve("runs", `live-${randomUUID()}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });

  async function save(name, value) {
    await writeFile(join(directory, name),
      JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  }
  async function event(type, details) {
    await appendFile(join(directory, "events.jsonl"), JSON.stringify({
      time: new Date().toISOString(), type, ...details
    }) + "\n", { mode: 0o600 });
  }
  const results = new Map();
  const summary = [];
  console.log(`Run records: ${directory}`);
  console.log(`Model requested: ${model}`);

  try {
    console.log("Running local verification before model calls...");
    const verification = await collectVerification();
    await save("verification.json", verification);
    if (!verification.passed) {
      throw new Error("Verification failed; inspect verification.json. No model calls made.");
    }
    await event("verification_completed", {
      evidenceId: verification.evidenceId, passed: verification.passed
    });
    console.log(`PASS: ${verification.counts.pass} tests; evidence recorded.`);

    for (const agent of agents) {
      const assignment = await buildAssignment(agent, resolve("fixtures/demo"));
      const peerEvidence = assignment.receivesFrom.map(agentId => {
        const previous = results.get(agentId);
        assert.ok(previous, `Missing completed output from ${agentId}`);
        return {
          agentId,
          responseId: previous.responseId,
          outputHash: hash(previous.text),
          sourceFilesSeen: previous.sourceFilesSeen,
          text: previous.text
        };
      });
      const input = {
        task: assignment.task,
        sourceContext: assignment.sourceContext,
        peerEvidence,
        verificationEvidence: agent.id === "investigator" ? null : verification
      };
      const request = {
        model,
        store: false,
        instructions: assignment.systemPrompt + "\n\n" + [
          "Return a concise review in at most 600 words.",
          "Explicitly assess each supplied peer review.",
          "Each peer sourceFilesSeen lists the exact source files that peer received.",
          "Distinguish direct source access from claims in peer messages.",
          "Judge earlier context limitations against that peers sourceFilesSeen, not your own files.",
          "When your broader context resolves a gap, label it newly available evidence, not a peer error.",
          "Cite source filenames and line numbers.",
          "You have no execution tools yourself.",
          "If verificationEvidence is supplied, attribute executed tests to the local test runner.",
          "Inspect its scope, test source, results, and limitations before using it.",
          "The original handler and corrected handler are separate files.",
          "A passing defect-reproduction test means the original defect was reproduced, not fixed.",
          "Peer sourceFilesSeen describes their initial source context; peers may additionally receive verification evidence.",
          "Do not claim deployed exploitability from handler-only tests.",
          "Without verification evidence, describe your conclusions as static analysis."
        ].join("\n"),
        input: JSON.stringify(input, null, 2),
        max_output_tokens: 4000
      };
      await save(`${agent.id}.assignment.json`, assignment);
      await save(`${agent.id}.request.json`, request);
      const recordedInput = JSON.parse(request.input);
      for (const peer of recordedInput.peerEvidence) {
        assert.equal(peer.text, results.get(peer.agentId).text);
        assert.equal(peer.outputHash, hash(peer.text));
        await event("handoff", {
          from: peer.agentId, to: agent.id,
          responseId: peer.responseId, outputHash: peer.outputHash
        });
      }
      console.log(`\nStarting ${agent.id}; receives: ` +
        (assignment.receivesFrom.join(", ") || "initial task"));
      await event("agent_started", { agentId: agent.id });
      const started = Date.now();
      const response = await callModel(request);
      await save(`${agent.id}.response.json`, response);
      if (response.status !== "completed") {
        throw new Error(`${agent.id}: response status=${response.status}; ` +
          `reason=${response.incomplete_details?.reason ?? "unknown"}`);
      }
      const refused = (response.output ?? []).some(item =>
        (item.content ?? []).some(part => part.type === "refusal"));
      if (refused) throw new Error(`${agent.id}: model returned a refusal.`);
      const text = extractText(response);
      if (!text) throw new Error(`${agent.id}: no text returned.`);
      await writeFile(join(directory, `${agent.id}.md`), text + "\n", { mode: 0o600 });
      results.set(agent.id, {
        text,
        responseId: response.id,
        sourceFilesSeen: assignment.sources.map(s => ({ file: s.file, sha256: s.sha256 }))
      });
      const record = {
        agent: agent.id,
        model: response.model,
        responseId: response.id,
        durationMs: Date.now() - started,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        receivedFrom: assignment.receivesFrom
      };
      summary.push(record);
      await event("agent_completed", record);
      console.log(`Completed ${agent.id}`);
    }
    await save("summary.json", {
      status: "completed", agents: summary,
      executedTests: true, verificationEvidenceId: verification.evidenceId
    });
    console.table(summary.map(row => ({
      agent: row.agent, model: row.model,
      inputTokens: row.inputTokens, outputTokens: row.outputTokens,
      seconds: (row.durationMs / 1000).toFixed(1)
    })));
    console.log("\nREPORTER OUTPUT\n");
    console.log(results.get("reporter").text);
    console.log(`\nFull records: ${directory}`);
    console.log("PASS: Three model responses and exact dependency handoffs.");
    console.log("Local test evidence was supplied to challenger and reporter.");
    console.log("Report accuracy still requires checking against that evidence.");
  } catch (error) {
    await save("summary.json", {
      status: "failed", completedAgents: summary, error: error.message
    });
    await event("run_failed", { error: error.message });
    throw error;
  }
}
main().catch(error => {
  console.error(`STOPPED: ${error.message}`);
  process.exitCode = 1;
});
