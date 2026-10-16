import { getDocument } from "./repository.js";
import { canReadDocument } from "./policy.js";

export async function downloadDocument(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const document = await getDocument(req.params.id);

  if (!document) {
    return res.status(404).json({ error: "Not found" });
  }

  if (!canReadDocument(req.user, document)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.json(document);
}
