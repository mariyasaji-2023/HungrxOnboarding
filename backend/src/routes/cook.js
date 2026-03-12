const express = require("express");
const router = express.Router();
const User = require("../models/User");
const DailyLog = require("../models/DailyLog");
const { getCurrency } = require("../utils/currency");

// ── Reverse geocode lat/lng → city, region, country ──────────
const reverseGeocode = async (lat, lng) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey || !lat || !lng) return { city: "unknown", region: "unknown", country: "unknown" };
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK") return { city: "unknown", region: "unknown", country: "unknown" };
    const components = data.results?.[0]?.address_components || [];
    const get = (type) => components.find((c) => c.types.includes(type))?.long_name || "unknown";
    return {
      city: get("locality") || get("administrative_area_level_2"),
      region: get("administrative_area_level_1"),
      country: get("country"),
    };
  } catch {
    return { city: "unknown", region: "unknown", country: "unknown" };
  }
};

// ── Gemini call with JSON repair ─────────────────────────────
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
        maxOutputTokens: 16384,
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
  } catch {
    // Repair truncated JSON
    let repaired = rawText.trimEnd().replace(/,\s*$/, "");
    const stack = [];
    for (const ch of repaired) {
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
    repaired += stack.reverse().join("");
    try {
      return JSON.parse(repaired);
    } catch (e) {
      throw new Error("Failed to parse Gemini response: " + e.message);
    }
  }
};

// ── Build cook() prompt with full ranker ─────────────────────
const buildCookPrompt = (user, location, history, datetime, currency) => {
  const now = new Date(datetime);
  const hour = now.getHours();
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const isWeekend = ["Saturday", "Sunday"].includes(day);
  const mealMoment = hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : hour < 22 ? "dinner" : "late-night";

  const skillMap = {
    "Beginner - Don't enjoy": "beginner",
    "Beginner - Enjoy learning": "beginner",
    "Intermediate": "intermediate",
    "Advanced - Love cooking": "advanced",
  };
  const skillLevel = skillMap[user.cookingSkill] || "intermediate";
  const calsPerMeal = Math.round((user.dailyCalorieTarget || user.tdee || 2000) / 3);

  // Last 20 recipes from meal history
  const last20 = history
    .flatMap((log) => (log.meals || []).map((m) => ({
      recipe_name: m.name,
      cuisine: m.source || "unknown",
      date: m.loggedAt,
    })))
    .slice(0, 20);

  const last3Cuisines = [...new Set(last20.map((m) => m.cuisine).filter(Boolean))].slice(0, 3);

  return `You are a personal recipe curator. You find real recipes for this specific person right now based on who they are and where they are.
You do not invent recipes. You do not fake ingredients. You do not suggest what cannot be found near them.
One job. Match real recipes to real availability. Apply global ranker. Return best 10.

INPUTS
------
[user_profile] + [live] — always ONE signal, never separate:
- Name: ${user.name || "User"}
- Age: ${user.age || "unknown"}
- Gender: ${user.gender || "unknown"}
- Primary goal: ${user.primaryGoal || "Maintain Weight"}
- Calorie target per meal: ${calsPerMeal} kcal
- Dietary restrictions: ${user.restrictions || "none"}
- Food dislikes: ${user.dislikes || "none"}
- Favourite foods: ${user.favorites || "no specific preference"}
- Skill level: ${skillLevel}
- Kitchen equipment: standard home kitchen (stovetop, oven, knife)
- Time: ${datetime}
- Day: ${day}
- Meal moment: ${mealMoment}
- Weekend: ${isWeekend}
- Location: ${location.city}, ${location.region}, ${location.country}

[history]:
- Last 20 recipes cooked or viewed: ${JSON.stringify(last20)}
- Most cooked cuisines: ${JSON.stringify(last3Cuisines)}

LOCATION FILTER — RUNS BEFORE ANYTHING ELSE:
Step 1 → Identify the region and its commonly available ingredients. What grows there. What is sold in local markets. What is part of the regional food culture.
Step 2 → Build an availability profile for that location:
  Kerala → coconut, rice, fish, curry leaves, tamarind, raw banana, drumstick, local greens, lentils
  Punjab → wheat, mustard greens, paneer, ghee, dal
  Mumbai → broad availability but price sensitive
  Karnataka → ragi, rice, coconut, lentils, curry leaves, local vegetables
  Apply this logic for any region globally.
Step 3 → Filter all recipes through this availability profile. If a recipe needs an ingredient that is hard to source in that region → skip it.
Step 4 → Budget check. Ingredients must be affordable at local market prices.
         Currency: \${currency.symbol} (\${currency.code}) — use this for any cost references.

RULES — NON NEGOTIABLE:
1. SOURCE → Authentic real recipes only. No invented dishes. No ingredient swaps to force fit.
2. RANKING ORDER:
   Tier 1 (satisfy completely first):
   → Supports primary goal → Calorie target not exceeded → Dietary restrictions — no exceptions → Location availability confirmed
   Tier 2 (within Tier 1):
   → Within budget at local prices → Matches cuisine and spice preference → Macro targets met
   Tier 3 (within Tier 2):
   → Comfort food consideration → Discovery openness
3. AVAILABILITY → Every ingredient must be commonly available in user's region. No exotic/imported unless location supports it.
4. PORTIONS → All quantities scaled to exactly 1 person. Be precise: not "some onion" but "half medium onion".
5. COOK TIME → ${isWeekend ? "Weekend — longer cooks acceptable" : "Weekday — nothing over 30 mins for snack/lunch, 45 mins max for dinner"}
6. FRESHNESS → No recipe repeated from history. Max 1 same cuisine across 10 results. At least 2 discovery picks outside usual pattern.
7. INSTRUCTIONS → Maximum 8 steps. One action per step. Plain language. Specific not vague: not "season to taste" but "add half tsp salt".

OUTPUT SIZE LIMITS (prevents truncation):
- Return exactly 10 recipes
- Each recipe: include full ingredients list and full instructions (max 8 steps)
- why_picked: max 1 sentence, 120 characters
- cook_note: max 1 sentence, 100 characters
- ingredient strings: precise measurement + ingredient name only

why_picked — strict rule:
WRONG: "Healthy and easy"
WRONG: "User likes Italian"
RIGHT: "Primary goal weight loss + ${day} ${mealMoment} in ${location.region} → fish curry with rice, all ingredients locally available, under calorie target"

cook_note — strict rule:
One sentence. Talk like you know them.
RIGHT: "All ingredients are at your local market today"
RIGHT: "Quick 20 minute cook fits your ${day} evening"

Return ONLY this JSON, no markdown:
{
  "user_context": {
    "name": "${user.name || "User"}",
    "location": "${location.city}, ${location.region}",
    "meal_moment": "${mealMoment}",
    "inferred_mode": "comfort | healthy | quick | exploratory"
  },
  "availability_region": "brief description of region ingredient profile used",
  "recipes": [
    {
      "rank": 1,
      "name": "Authentic Recipe Name",
      "cuisine": "",
      "cook_time_mins": 0,
      "calories_approx": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0,
      "skill_level": "beginner | intermediate | advanced",
      "all_ingredients_available": true,
      "why_picked": "tier1+tier2 signal + live location signal → why this recipe right now",
      "source": "recipe origin or reference",
      "ingredients": ["precise measurement and ingredient"],
      "instructions": ["1. one action one sentence", "2. one action one sentence"],
      "cook_note": "One line. Personal. Direct."
    }
  ],
  "freshness_applied": true
}`;
};

// ── POST /api/cook/recipes ────────────────────────────────────
router.post("/recipes", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const [user, history] = await Promise.all([
      User.findById(userId),
      DailyLog.find({ userId }).sort({ date: -1 }).limit(10).lean(),
    ]);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Reverse geocode user's saved location
    const location = await reverseGeocode(user.location?.lat, user.location?.lng);
    const currency = getCurrency(location.country);
    console.log(`🍳 Generating recipes for ${user.name} in ${location.city}, ${location.region} (${currency.code})`);

    const prompt = buildCookPrompt(user, location, history, new Date().toISOString(), currency);
    const result = await callGemini(prompt);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Cook error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;