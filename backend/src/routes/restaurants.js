const express = require("express");
const router = express.Router();
const User = require("../models/User");
const DailyLog = require("../models/DailyLog");

// In-memory menu cache: placeId -> { menu, order }
const menuCache = {};

const today = () => new Date().toISOString().split("T")[0];

// ── POST /api/restaurants/nearby ─────────────────────────────
router.post("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 1500 } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, message: "lat and lng required" });

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: "GOOGLE_PLACES_API_KEY not set" });

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return res.status(500).json({ success: false, message: "Places error: " + data.status });
    }

    const restaurants = (data.results || []).slice(0, 15).map((place) => ({
      id: place.place_id,
      name: place.name,
      vicinity: place.vicinity,
      rating: place.rating || null,
      userRatingsTotal: place.user_ratings_total || 0,
      priceLevel: place.price_level || null,
      openNow: place.opening_hours?.open_now ?? null,
      icon: place.name.charAt(0).toUpperCase(),
      types: place.types || [],
    }));

    res.json({ success: true, data: restaurants });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/restaurants/menu ────────────────────────────────
// Uses Meal Concierge Engine prompt with user profile + history
router.post("/menu", async (req, res) => {
  try {
    const { placeId, placeName, priceLevel, cuisine, userId, lat, lng } = req.body;
    if (!placeId || !placeName) return res.status(400).json({ success: false, message: "placeId and placeName required" });

    // Return cached result instantly
    if (menuCache[placeId]) {
      console.log("Menu cache hit:", placeName);
      return res.json({ success: true, data: menuCache[placeId], cached: true });
    }

    console.log("Generating concierge menu for:", placeName);

    // Fetch user profile + today's meal history in parallel
    let user = null;
    let recentMeals = [];

    if (userId) {
      try {
        [user, recentMeals] = await Promise.all([
          User.findById(userId),
          DailyLog.find({ userId }).sort({ date: -1 }).limit(7).lean(),
        ]);
      } catch (e) {
        console.error("User/history fetch failed:", e.message);
      }
    }

    const datetime = new Date().toISOString();
    const hour = new Date().getHours();
    const mealMoment = hour < 10 ? "breakfast" : hour < 14 ? "lunch" : hour < 18 ? "snack" : "dinner";
    const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const calsPerMeal = user ? Math.round((user.dailyCalorieTarget || user.tdee || 2000) / 3) : 600;
    const budgetStr = user?.budget || "moderate (under $15)";

    // Build last 20 meals from history
    const lastMeals = recentMeals
      .flatMap((log) => log.meals || [])
      .slice(0, 20)
      .map((m) => ({ item: m.name, source: m.source, date: m.loggedAt }));

    const skillMap = {
      "Beginner - Don't enjoy": "beginner",
      "Beginner - Enjoy learning": "beginner",
      "Intermediate": "intermediate",
      "Advanced - Love cooking": "advanced",
    };

    const conciergePrompt = `SYSTEM PROMPT — MEAL CONCIERGE ENGINE v1.0
===========================================
You are a personal meal concierge. You don't suggest — you ORDER.
Given a chosen restaurant, you build the perfect meal for this specific user, right now.
Think like a friend who knows exactly what they need and orders for them without asking.
[user profile] and [live] are always one combined signal. Never split them.

INPUTS
------
[user profile] + [live]:
- Name: ${user?.name || "User"}
- Age: ${user?.age || "unknown"}
- Gender: ${user?.gender || "unknown"}
- Dietary restrictions: ${user?.restrictions || "none"}
- Food dislikes: ${user?.dislikes || "none"}
- Favorite foods: ${user?.favorites || "no specific preference"}
- Health goal: ${user?.primaryGoal || "Maintain Weight"}
- Calorie target per meal: ${calsPerMeal} kcal
- Budget per meal: ${budgetStr}
- Current GPS: ${lat || "unknown"}, ${lng || "unknown"}
- Current timestamp: ${datetime}
- Meal moment: ${mealMoment}
- Day: ${day}

[history]
- Last meals logged: ${JSON.stringify(lastMeals.slice(0, 10))}

[restaurant]
- Chosen restaurant name: ${placeName}
- Cuisine type: ${cuisine || "general"}
- Price level: ${priceLevel ? "$".repeat(priceLevel) : "unknown"}
- Use your knowledge of this restaurant's real menu. If it's a known chain, use actual menu items. If local, generate realistic items for this cuisine type.

RULES (NON-NEGOTIABLE)
1. Use real/realistic menu items for this specific restaurant
2. Provide calories, protein, carbs, fat for every item
3. Total order must stay within budget
4. Do NOT repeat items from recent history
5. Build a complete balanced meal for the meal moment
6. Make the decision — never ask the user
7. Every why_ordered must reference BOTH user profile AND live signal

Return ONLY this JSON, no markdown:
{
  "user_context": {
    "name": "${user?.name || "User"}",
    "restaurant": "${placeName}",
    "meal_moment": "${mealMoment}",
    "inferred_mode": "calorie-controlled | indulgence | high-protein | balanced | light",
    "time": "${datetime}"
  },
  "menu": {
    "categories": [
      {
        "name": "Category Name",
        "items": [
          {
            "name": "Item Name",
            "description": "brief description",
            "calories": 450,
            "protein": 25,
            "carbs": 40,
            "fat": 18,
            "price": 12.99,
            "macro_source": "official menu | ~estimated"
          }
        ]
      }
    ]
  },
  "recommended_order": [
    {
      "category": "main | side | drink | dessert",
      "item": "Exact Item Name",
      "price": 12.99,
      "calories": 540,
      "macros": { "protein_g": 32, "carbs_g": 48, "fat_g": 14 },
      "macro_source": "official menu | ~estimated",
      "why_ordered": "[user profile] signal + [live] signal → why this item right now"
    }
  ],
  "order_summary": {
    "total_items": 2,
    "total_calories": 780,
    "total_cost": 24.50,
    "within_budget": true,
    "within_calorie_target": true,
    "freshness_applied": true
  },
  "concierge_note": "One personal sentence talking directly to ${user?.name || "you"}."
}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: conciergePrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Gemini error");
    }

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const result = JSON.parse(rawText);

    // Cache it
    menuCache[placeId] = result;

    res.json({ success: true, data: result, cached: false });
  } catch (err) {
    console.error("Menu error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;