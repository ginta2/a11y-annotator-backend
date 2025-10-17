import express from "express";

const app = express();

// --- CORS Middleware ---
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ["https://www.figma.com", "https://figma.com", "null"];

  let allowOrigin = "*"; // default fallback
  if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  console.log(`[SRV] ${req.method} ${req.path} | Origin: ${origin || "(none)"}`);

  if (req.method === "OPTIONS") {
    console.log("[SRV] Preflight OK");
    return res.status(204).end();
  }

  next();
});

// --- Body Parser ---
app.use(express.json({ limit: "2mb" }));

// --- Health Endpoint ---
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});

// --- Main Annotate Route ---
app.post("/annotate", async (req, res) => {
  try {
    console.log("[SRV] Received annotate request", {
      platform: req.body.platform,
      frames: req.body.frames?.length,
    });

    // Example success reply
    res.json({
      ok: true,
      message: "Annotation received successfully",
    });
  } catch (err) {
    console.error("[SRV] annotate error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// --- Start Server ---
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`[SRV] Listening on http://localhost:${port}`);
});