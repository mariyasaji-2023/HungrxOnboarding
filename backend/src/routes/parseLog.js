const express = require("express");
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

router.post("/parse", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    const prompt = `You are a nutrition parser. The user describes what they ate in natural language.
Your only job is to identify every food item and return structured nutrition data.

RULES — NON NEGOTIABLE:
- If no amount is given → assume one standard single serving
- If a vague amount is given like "some" or "a bit" → assume half a standard serving
- If a specific amount is given → use it exactly
- Every food item gets its own object in the array
- Condiments, drinks, sides — all get their own object
- If you cannot identify a food → skip it silently
- Never return an empty array if any food was identified
- Calories must always be a whole number
- Macros must always be whole numbers

OUTPUT FORMAT — Just the raw array, no markdown, no backticks, no explanation:
[
  {
    "name": "Scrambled Eggs",
    "calories": 180,
    "protein": 12,
    "carbs": 2,
    "fat": 13,
    "portion": "2 large eggs"
  }
]

EXAMPLES:
Input: "two scrambled eggs and black coffee"
Output: [{"name":"Scrambled Eggs","calories":180,"protein":12,"carbs":2,"fat":13,"portion":"2 large eggs"},{"name":"Black Coffee","calories":2,"protein":0,"carbs":0,"fat":0,"portion":"240ml"}]

Input: "had some rice and dal with ghee"
Output: [{"name":"Cooked Rice","calories":200,"protein":4,"carbs":44,"fat":0,"portion":"200g"},{"name":"Dal","calories":150,"protein":9,"carbs":22,"fat":3,"portion":"1 standard bowl"},{"name":"Ghee","calories":45,"protein":0,"carbs":0,"fat":5,"portion":"1 tsp"}]

Input: "a bowl of oats with banana and black coffee"
Output: [{"name":"Oats","calories":150,"protein":5,"carbs":27,"fat":3,"portion":"40g dry"},{"name":"Banana","calories":89,"protein":1,"carbs":23,"fat":0,"portion":"1 medium"},{"name":"Black Coffee","calories":2,"protein":0,"carbs":0,"fat":0,"portion":"240ml"}]

Now parse this input:
"${text}"`;

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const items = JSON.parse(cleaned);

    // Ensure every item has required fields with safe defaults
    const safe = items.map((item) => ({
      name: item.name || "Unknown",
      calories: Math.round(item.calories || 0),
      protein: Math.round(item.protein || 0),
      carbs: Math.round(item.carbs || 0),
      fat: Math.round(item.fat || 0),
      portion: item.portion || "1 serving",
    }));

    res.json({ success: true, items: safe });
  } catch (err) {
    console.error("Log parse error:", err.message);
    res.status(500).json({ error: "Parse failed" });
  }
});

module.exports = router;