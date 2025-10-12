import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

app.get("/health", (_, res) => {
  res.json({
    status: "healthy",
    hasKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.MODEL || "gpt-4o-mini",
    version: "1.0.0"
  });
});

app.post("/annotate", async (req, res) => {
  try {
    console.log("[ANNOTATE] Request body keys:", Object.keys(req.body || {}));
    const { platform, text, imageBase64 } = req.body;

    // Mock AI response for now
    const response = {
      ok: true,
      annotations: [
        { id: 1, label: "Button: Start Workout" },
        { id: 2, label: "Text: Weekly Goal" },
        { id: 3, label: "Input: Enter Name" }
      ],
      platform,
      model: process.env.MODEL || "gpt-4o-mini"
    };

    res.json(response);
  } catch (err) {
    console.error("ANNOTATE error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[SRV] Listening on http://localhost:${PORT}`);
});