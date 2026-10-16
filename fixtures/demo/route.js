import { getDocument } from "./repository.js";
import { canReadDocument } from "./policy.js";

export async function downloadDocument(req, res) {
  const document = await getDocument(req.params.id);
  if (!document) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.json(document);
}
