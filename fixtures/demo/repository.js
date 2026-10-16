const documents = new Map([
  ["doc-a", { id: "doc-a", tenantId: "tenant-a", text: "Demo A" }],
  ["doc-b", { id: "doc-b", tenantId: "tenant-b", text: "Demo B" }]
]);

export async function getDocument(id) {
  return documents.get(id) ?? null;
}
