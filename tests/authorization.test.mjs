import test from "node:test";
import assert from "node:assert/strict";
import { downloadDocument as original } from "../fixtures/demo/route.js";
import { downloadDocument as fixed } from "../fixtures/demo/route-fixed.js";

async function invoke(handler, id, user) {
  const result = { status: 200, body: undefined };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  await handler({ params: { id }, user }, res);
  return result;
}

const tenantA = { id: "user-a", tenantId: "tenant-a" };

test("Original: reproduces cross-tenant document disclosure", async () => {
  const result = await invoke(original, "doc-b", tenantA);
  assert.equal(result.status, 200);
  assert.equal(result.body.tenantId, "tenant-b");
  assert.equal(result.body.text, "Demo B");
});

test("Original: reproduces document disclosure without a user", async () => {
  const result = await invoke(original, "doc-b", undefined);
  assert.equal(result.status, 200);
  assert.equal(result.body.text, "Demo B");
});

test("Fixed: same-tenant access succeeds", async () => {
  const result = await invoke(fixed, "doc-a", tenantA);
  assert.equal(result.status, 200);
  assert.equal(result.body.id, "doc-a");
  assert.equal(result.body.text, "Demo A");
});

test("Fixed: cross-tenant access is denied without document data", async () => {
  const result = await invoke(fixed, "doc-b", tenantA);
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: "Forbidden" });
});

test("Fixed: unauthenticated access is denied", async () => {
  const result = await invoke(fixed, "doc-a", undefined);
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "Authentication required" });
});

test("Fixed: unknown document returns 404", async () => {
  const result = await invoke(fixed, "missing", tenantA);
  assert.equal(result.status, 404);
  assert.deepEqual(result.body, { error: "Not found" });
});

test("Fixed: user without a tenant is denied", async () => {
  const result = await invoke(fixed, "doc-a", { id: "user-x" });
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: "Forbidden" });
});
