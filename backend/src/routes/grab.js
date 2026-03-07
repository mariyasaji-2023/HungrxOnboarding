const express = require("express");
const router = express.Router();
const User = require("../models/User");
const DailyLog = require("../models/DailyLog");

// ── POST /api/grab/items ──────────────────────────────────────
router.post("/items", async (req, res) => {
  try {
    const { userId, lat, lng } = req.body;

    let user = null;
    let recentMeals = [];

    if (userId) {
      try {
        [user, recentMeals] = await Promise.all([
          User.findById(userId),
          DailyLog.find({ userId }).sort({ date: -1 }).limit(7).lean(),
        ]);
      } catch (e) { console.error("User fetch error:", e.message); }
    }

    const datetime = new Date().toISOString();
    const hour = new Date().getHours();
    const moment = hour < 10 ? "morning snack" : hour < 14 ? "midday" : hour < 18 ? "evening" : "late-night";
    const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const calsPerSnack = user ? Math.round((user.dailyCalorieTarget || 2000) / 5) : 400;

    const lastItems = recentMeals.flatMap(l => l.meals || []).slice(0, 20).map(m => m.name);

    const prompt = `SYSTEM PROMPT — READY-TO-EAT GROCERY FINDER ENGINE v1.0
You are a personal grocery curator. Find real, purchasable, ready-to-eat items for this person right now.
[user profile] + [live] always combined signal.

[user profile] + [live]:
- Name: ${user?.name || "User"}
- Age: ${user?.age || "unknown"}
- Health goal: ${user?.primaryGoal || "Maintain Weight"}
- Dietary restrictions: ${user?.restrictions || "none"}
- Calorie target per snack: ${calsPerSnack} kcal
- Current GPS: ${lat || user?.location?.lat || "unknown"}, ${lng || user?.location?.lng || "unknown"} — infer nearby grocery stores
- Timestamp: ${datetime}
- Consumption moment: ${moment}
- Day: ${day}

[history]:
- Last items picked: ${JSON.stringify(lastItems.slice(0, 10))}

RULES:
1. Real brand + exact product + exact flavor/variant. No generic items.
2. Single serve / individual size only.
3. Exactly 3 categories x 4 items = 12 items total. Keep it focused.
4. No repeated items from history.
5. Price + calories + macros on every item.
6. Prioritize products available near the user's location.

Return ONLY this JSON, no markdown:
{
  "user_context": {
    "name": "${user?.name || "User"}",
    "consumption_moment": "${moment}",
    "inferred_mode": "calorie-controlled | indulgence | high-protein | light | comfort",
    "time": "${datetime}"
  },
  "grocery_list": [
    {
      "category": "Category Name",
      "category_note": "Why this category fits right now",
      "items": [
        {
          "rank": 1,
          "brand": "Brand Name",
          "product": "Product Name",
          "variant": "exact size/flavor",
          "price_approx": 1.20,
          "calories": 190,
          "macros": { "protein_g": 2, "carbs_g": 24, "fat_g": 9 },
          "available_single_serve": true,
          "why_picked": "[user profile] signal + [live] signal → why this product now"
        }
      ]
    }
  ],
  "session_summary": {
    "total_categories": 3,
    "total_items": 12,
    "freshness_applied": true,
    "new_category_introduced": "Category Name"
  },
  "curator_note": "One personal sentence telling them what to grab first."
}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 65536, responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) throw new Error("Gemini error: " + response.status);

    const geminiData = await response.json();
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const result = JSON.parse(raw);

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Grab error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;