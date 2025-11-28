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
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function analyzeNews({ type, text, url }) {
  const baseInstruction = `
You are an AI fake news detection system.

Given a news item (either full text or URL), you must respond ONLY in valid JSON with this shape:

{
  "label": "fake" | "real" | "uncertain",
  "confidence": 0.0 to 1.0,
  "explanation": "short explanation in simple English"
}

Rules:
- "fake" = very likely false / misleading
- "real" = very likely true / credible
- "uncertain" = not enough information to decide
- confidence = number between 0 and 1
- Do NOT add any extra text outside the JSON.
`;

  const userContent =
    type === "text"
      ? `News text:\n${text}`
      : `News URL: ${url}\nIf you cannot actually open the URL, mark label as "uncertain" and explain why.`;

  const prompt = baseInstruction + "\n\n" + userContent;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const rawText = response.text(); // model se JSON string expected hai

  let parsed;
  try {
    parsed = JSON.parse(rawText);
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
