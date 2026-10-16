# SwarmAudit100 — Checkpoint 6

Reconstructed from the working checkpoint-6 commands in the conversation. This is the command-line three-agent foundation, before Axios ingestion and the five-agent runner were added. It is not a copy exported from Diego's computer. Formatting has been normalized; checkpoint behavior and prompts are retained.

## Requirements

Node.js 24 or newer and npm. No third-party packages are required, so npm install is unnecessary.

Run commands from the extracted SwarmAudit100 directory.

## Local checks (no API calls)

```bash
npm test
npm run check
node --input-type=module -e 'import { collectVerification } from "./src/verification.mjs"; const e = await collectVerification(); console.table(e.counts); console.log({passed:e.passed,sourcesUnchanged:e.sourcesUnchanged}); if (!e.passed) process.exitCode=1;'
```

Expected: 12 tests pass, three distinct prompts and source contexts, valid handoff configuration, and verification passed with unchanged sources.

Two passing authorization tests intentionally reproduce the vulnerable original handler's behavior. Five test the separate corrected handler. Five test the hardened tenant policy. This is local demo evidence, not evidence about deployed applications.

## Live three-agent demo

```bash
read -rsp "OpenAI API key: " OPENAI_API_KEY
echo
export OPENAI_API_KEY
export OPENAI_MODEL="gpt-6-astra"
npm run demo:live
```

This makes up to three paid model calls after local verification passes. Your API project must have access to the chosen model. An alternative API model ID can be supplied through OPENAI_MODEL.

Optional: copy .env.example to .env, fill it locally, and run:

```bash
node --env-file=.env scripts/run-demo.mjs
```

The npm command does not load .env automatically. The example contains no key.

## Agent contexts and evidence

- Investigator: route.js and repository.js; no peer output or executed test evidence.
- Challenger: route.js and policy.js; investigator output and local verification evidence.
- Reporter: route.js, repository.js and policy.js; both peer outputs and local verification evidence.

Verification evidence includes all four fixture files and both test sources. Therefore challenger and reporter see those extra source snapshots in addition to their initially assigned files. Source overlap is deliberate; distinct context hashes do not prove independence or exhaustive coverage.

Each live run writes requests, responses, assignments, peer source provenance, SHA-256 output hashes, handoff events, token usage, test evidence and a summary under runs/. The program supplies evidence through a sequential investigator → challenger → reporter workflow; it is not an autonomous tool-using swarm yet.

## Snapshot scope

Includes checkpoint-6 application source, both test suites, and usage instructions. Excludes later Axios and Daybreak changes, historical runs, local backup copies, API keys, and the original 100-agent UI sample. There is no web UI or 100-agent implementation in checkpoint 6.

The live adapter uses the Responses API without an explicit Daybreak access_programs field, matching checkpoint 6. No live API calls were made while reconstructing this ZIP. Local validation results are in VALIDATION.txt.
