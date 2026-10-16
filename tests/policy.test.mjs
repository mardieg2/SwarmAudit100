import test from "node:test";
import assert from "node:assert/strict";
import { canReadDocument } from "../fixtures/demo/policy.js";

test("Policy: matching valid tenants are allowed", () => {
  assert.equal(canReadDocument({ tenantId: "tenant-a" }, { tenantId: "tenant-a" }), true);
});
test("Policy: different tenants are denied", () => {
  assert.equal(canReadDocument({ tenantId: "tenant-a" }, { tenantId: "tenant-b" }), false);
});
test("Policy: missing tenant IDs on both objects are denied", () => {
  assert.equal(canReadDocument({}, {}), false);
});
test("Policy: invalid tenant IDs are denied even when equal", () => {
  for (const tenantId of [undefined, null, "", " ", 0, false]) {
    assert.equal(canReadDocument({ tenantId }, { tenantId }), false,
      `Should deny tenant ID: ${JSON.stringify(tenantId)}`);
  }
});
test("Policy: missing user or document is denied without throwing", () => {
  assert.equal(canReadDocument(null, { tenantId: "tenant-a" }), false);
  assert.equal(canReadDocument({ tenantId: "tenant-a" }, null), false);
});
