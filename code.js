const API_BASE = "http://localhost:8787"; // Local backend for development

async function exportSelectedFrameAsBase64() {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length !== 1 || selection[0].type !== "FRAME") {
    throw new Error("Select exactly one Frame before running this command.");
  }
  const bytes = await selection[0].exportAsync({ format: "PNG" });
  const base64 = figma.base64Encode(bytes);
  return base64;
}

async function proposeFocusOrder(platform, textPrompt = "") {
  let body;

  if (platform === "web") {
    body = { platform: "web", text: textPrompt || "" };
  } else if (platform === "rn") {
    const imageBase64 = await exportSelectedFrameAsBase64();
    body = { platform: "rn", imageBase64 };
  } else {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const res = await fetch(`${API_BASE}/annotate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Backend error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  figma.ui.postMessage({ type: "RESULT", payload: data });
}

figma.ui.onmessage = async (msg) => {
  try {
    if (msg?.type === 'PROPOSE' && (msg.platform === 'rn' || msg.platform === 'web')) {
      await proposeFocusOrder(msg.platform, msg.text || "");
    }
  } catch (err) {
    figma.ui.postMessage({
      type: "RESULT",
      payload: { ok: false, message: String(err?.message || err) }
    });
  }
};