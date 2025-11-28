// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS allow (GitHub Pages se call ke liye)
app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

// Gemini init
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


async function analyzeNews({ type, text, url }) {
  const baseInstruction = `
You are an AI fake news detection system.

IMPORTANT: Respond ONLY with a single valid JSON object — no backticks, no code block, no text outside JSON.

Valid JSON format:

{
  "label": "fake" | "real" | "uncertain",
  "confidence": 0.0 to 1.0,
  "explanation": "short explanation in simple English"
}
`;

  const userContent =
    type === "text"
      ? `News text:\n${text}`
      : `News URL:\n${url}\nIf you cannot open URL, respond with label "uncertain".`;

  const prompt = baseInstruction + "\n\n" + userContent;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const rawText = response.text()?.trim() || "";

  let cleaned = rawText;

  // Remove ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/```json/gi, "");
  cleaned = cleaned.replace(/```/g, "").trim();

  // Extract only { ... }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    parsed = {
      label: "uncertain",
      confidence: 0.0,
      explanation:
        "Model did not return valid JSON. Raw output was: " + rawText,
    };
  }

  if (!parsed.label) parsed.label = "uncertain";
  if (typeof parsed.confidence !== "number") parsed.confidence = 0.0;
  if (!parsed.explanation)
    parsed.explanation = "No explanation provided by model.";

  return parsed;
}

  if (!parsed.label) parsed.label = "uncertain";
  if (typeof parsed.confidence !== "number") parsed.confidence = 0.0;
  if (!parsed.explanation)
    parsed.explanation = "No explanation provided by the model.";

  return parsed;
}

// Health check
app.get("/", (req, res) => {
  res.send("Fake News Detection API (Gemini) is running");
});

// Main endpoint
app.post("/check-news", async (req, res) => {
  try {
    const { type, text, url } = req.body;

    if (type === "text" && !text) {
      return res.status(400).json({ error: "text is required" });
    }
    if (type === "url" && !url) {
      return res.status(400).json({ error: "url is required" });
    }

    const result = await analyzeNews({ type, text, url });

    return res.json({
      label: result.label,
      confidence: result.confidence,
      explanation: result.explanation,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
