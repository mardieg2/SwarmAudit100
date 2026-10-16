export async function callModel(request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is missing.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(180_000)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `OpenAI HTTP ${response.status}; code=${data.error?.code ?? "unknown"}; ` +
      `request_id=${response.headers.get("x-request-id") ?? "unknown"}`
    );
  }
  return data;
}

export function extractText(response) {
  return (response.output ?? [])
    .filter(item => item.type === "message")
    .flatMap(item => item.content ?? [])
    .filter(part => part.type === "output_text")
    .map(part => part.text)
    .join("\n")
    .trim();
}
