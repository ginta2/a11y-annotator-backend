import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const KEY = (process.env.OPENAI_API_KEY || '').trim();
const MODEL = process.env.MODEL || 'gpt-4o-mini';
const PORT = Number(process.env.PORT || 8787);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(bodyParser.json({ limit: "10mb" }));

app.get("/health", (_, res) => {
  res.json({
    status: "healthy",
    hasKey: Boolean(KEY),
    model: MODEL,
    port: PORT,
    version: "1.0.0",
    timestamp: new Date().toISOString()
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
      model: MODEL
    };

    res.json(response);
  } catch (err) {
    console.error("ANNOTATE error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[SRV] Listening on http://localhost:${PORT}`);
  console.log(`[SRV] Model: ${MODEL}`);
  console.log(`[SRV] OpenAI Key: ${KEY ? '✓ loaded' : '✗ missing'}`);
  console.log(`[SRV] Health check: http://localhost:${PORT}/health`);
});