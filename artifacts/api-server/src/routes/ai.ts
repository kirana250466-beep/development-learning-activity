import { Router } from "express";

const router = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/ai-grade", async (req, res) => {
  const { question, answer, key, instruction, point, model } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: "question and answer are required" });
  }

  const AI_GRADE_URL = process.env["AI_GRADE_URL"] || "https://api.sistemai.my.id/ai-grade";

  const response = await fetch(AI_GRADE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      answer,
      key,
      instruction,
      point,
      model: model || "qwen2.5:7b",
    }),
  });

  const text = await response.text();
  res.status(response.status).type("application/json").send(text);
});

export default router;