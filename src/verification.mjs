import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hash } from "./context.mjs";

const execute = promisify(execFile);

export async function collectVerification() {
  const testFiles = [
    "tests/authorization.test.mjs",
    "tests/policy.test.mjs"
  ];
  const files = [
    "fixtures/demo/route.js",
    "fixtures/demo/route-fixed.js",
    "fixtures/demo/repository.js",
    "fixtures/demo/policy.js",
    ...testFiles
  ];
  async function snapshot() {
    return Promise.all(files.map(async file => {
      const content = await readFile(resolve(file), "utf8");
      return { file, sha256: hash(content), content };
    }));
  }
  const before = await snapshot();
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const args = ["--test", "--test-reporter=tap", ...testFiles];
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  let executionError = null;
  try {
    const result = await execute(process.execPath, args, {
      cwd: process.cwd(), timeout: 30_000,
      maxBuffer: 1024 * 1024, encoding: "utf8"
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    stdout = error.stdout ?? "";
    stderr = error.stderr ?? "";
    exitCode = Number.isInteger(error.code) ? error.code : null;
    executionError = {
      code: error.code ?? null,
      signal: error.signal ?? null,
      killed: error.killed ?? false
    };
  }
  const after = await snapshot();
  const sourcesUnchanged = before.every(
    (file, index) => file.sha256 === after[index].sha256
  );
  const counts = {};
  for (const name of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    const matches = [...stdout.matchAll(
      new RegExp(`^# ${name} (\\d+)\\s*$`, "gm")
    )];
    counts[name] = matches.length === 1 ? Number(matches[0][1]) : null;
  }
  const passed =
    exitCode === 0 && executionError === null && sourcesUnchanged &&
    counts.tests > 0 && counts.pass === counts.tests &&
    counts.fail === 0 && counts.cancelled === 0 &&
    counts.skipped === 0 && counts.todo === 0;
  return {
    evidenceId: "local-demo-tests",
    producedBy: "local-node-test-runner",
    startedAt, durationMs: Date.now() - started,
    command: [process.execPath, ...args], nodeVersion: process.version,
    testFiles, counts, exitCode, executionError, passed, sourcesUnchanged,
    scope: "Local demo handler and policy tests; no real-project tests.",
    limitations: [
      "No deployed application or HTTP middleware was tested.",
      "Tests and fixes were supplied by the developer workflow.",
      "Passing tests establish only the explicitly tested behavior."
    ],
    interpretation:
      "Two authorization tests reproduce defects in the original handler. " +
      "Five authorization tests check the separate corrected handler. " +
      "Policy tests check the current policy implementation.",
    stdout, stderr, sourceSnapshots: before
  };
}
