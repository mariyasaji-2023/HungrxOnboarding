const express = require("express");
const router = express.Router();
const User = require("../models/User");

const callGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || "Gemini error " + response.status);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    return JSON.parse(rawText);
  } catch (e) {
    // Try to salvage partial JSON — extract whatever recipes parsed successfully
    const match = rawText.match(/"recipes"\s*:\s*\[[\s\S]*/);
    if (match) {
      // Find all complete recipe objects
      const recipes = [];
      const recipeRegex = /\{[^{}]*"rank"[^{}]*\}/gs;
      let m;
      while ((m = recipeRegex.exec(rawText)) !== null) {
        try {
          recipes.push(JSON.parse(m[0]));
        } catch (_) {}
      }
      if (recipes.length > 0) return { recipes };
    }
    throw new Error("Failed to parse Gemini response: " + e.message);
  }
};

const buildFullPrompt = (user, datetime) => {
  const hour = new Date(datetime).getHours();
  const mealMoment = hour < 10 ? "breakfast" : hour < 14 ? "lunch" : hour < 18 ? "snack" : "dinner";
  const day = new Date(datetime).toLocaleDateString("en-US", { weekday: "long" });
  const isWeekend = ["Saturday", "Sunday"].includes(day);
  const skillMap = {
    "Beginner - Don't enjoy": "beginner",
    "Beginner - Enjoy learning": "beginner",
    "Intermediate": "intermediate",
    "Advanced - Love cooking": "advanced",
  };
  const skillLevel = skillMap[user.cookingSkill] || "intermediate";
  const calsPerMeal = Math.round((user.dailyCalorieTarget || user.tdee || 2000) / 3);

  return "Return a JSON object with 5 complete recipes (not 10) including full ingredients and instructions.\n" +
    "User: " + user.name + ", goal: " + user.primaryGoal + ", meal: " + mealMoment + ", day: " + day + "\n" +
    "Calories per meal: " + calsPerMeal + " kcal, skill: " + skillLevel + "\n" +
    "Restrictions: " + (user.restrictions || "none") + ", dislikes: " + (user.dislikes || "none") + "\n" +
    "Each recipe: authentic, scaled to 1 person, max 6 instruction steps, keep ingredients list concise.\n\n" +
    "JSON schema:\n" +
    '{ "recipes": [ { "rank": 1, "name": string, "cuisine": string, "cook_time_mins": number, "calories_approx": number, "protein_g": number, "carbs_g": number, "fat_g": number, "skill_level": string, "why_picked": string, "source": string, "ingredients": [string], "instructions": [string], "cook_note": string } ] }';
};

router.post("/recipes", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const result = await callGemini(buildFullPrompt(user, new Date().toISOString()));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Cook error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;