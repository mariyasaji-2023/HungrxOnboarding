const express = require("express");
const router = express.Router();
const User = require("../models/User");
const DailyLog = require("../models/DailyLog");
const { getCurrency } = require("../utils/currency");

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

// ── POST /api/restaurants/rank ────────────────────────────────
// Takes Google Places list + user profile → Gemini ranks + personalizes → returns best 10
router.post("/rank", async (req, res) => {
  try {
    const { restaurants, userId, lat, lng } = req.body;
    if (!restaurants || !restaurants.length) return res.status(400).json({ success: false, message: "restaurants list required" });

    let user = null;
    let visitHistory = [];

    if (userId) {
      try {
        [user, visitHistory] = await Promise.all([
          User.findById(userId),
          DailyLog.find({ userId }).sort({ date: -1 }).limit(30).lean(),
        ]);
      } catch (e) {
        console.error("User/history fetch failed:", e.message);
      }
    }

    const now = new Date();
    const datetime = now.toISOString();
    const hour = now.getHours();
    const day = now.toLocaleDateString("en-US", { weekday: "long" });
    const mealMoment = hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : hour < 22 ? "dinner" : "late-night";

    // Build last 30 visits from history (source field often has restaurant name)
    const last30 = visitHistory
      .flatMap((log) => (log.meals || []).map((m) => ({ name: m.source, date: log.date })))
      .filter((v) => v.name)
      .slice(0, 30);

    const last3Cuisines = [...new Set(visitHistory
      .flatMap((log) => (log.meals || []).map((m) => m.source?.split("·")[0]?.trim()))
      .filter(Boolean)
    )].slice(0, 3);

    const rankPrompt = `SYSTEM PROMPT — RESTAURANT RANKER v1.0
You are a personal restaurant ranker. Google already fetched and verified everything. One job: rank the list, personalize it using the global ranker, return best 10 for this user right now.

INPUTS
------
[restaurant_list] — from Google Places API (already verified, already open, rating ≥ 3.5):
${JSON.stringify(restaurants.map(r => ({
  name: r.name,
  cuisine: r.types?.[0] || "restaurant",
  distance_m: r.distance_m || null,
  rating: r.rating,
  open_now: true,
  price_level: r.priceLevel,
  vicinity: r.vicinity,
  place_id: r.id,
  icon: r.icon,
  userRatingsTotal: r.userRatingsTotal,
})), null, 2)}

[user_profile] + [live] — always ONE signal, never separate:
- Name: ${user?.name || "User"}
- Age: ${user?.age || "unknown"}
- Gender: ${user?.gender || "unknown"}
- Primary goal: ${user?.primaryGoal || "Maintain Weight"}
- Daily calorie target: ${user?.dailyCalorieTarget || user?.tdee || 2000} kcal
- Dietary restrictions: ${user?.restrictions || "none"}
- Food dislikes: ${user?.dislikes || "none"}
- Favorite foods: ${user?.favorites || "no specific preference"}
- Budget: ${user?.budget || "moderate"}
- GPS: ${lat}, ${lng}
- Time: ${datetime}
- Day: ${day}
- Meal moment: ${mealMoment}

[history]:
- Last 30 visits: ${JSON.stringify(last30)}
- Last 3 cuisine choices: ${JSON.stringify(last3Cuisines)}

RULES — NON NEGOTIABLE:
1. SOURCE → Only rank restaurants from [restaurant_list]. Do not invent any.
2. RATINGS + OPEN → Already verified. Do not re-check.
3. DISTANCE SPLIT → 5 results within 500m → 3 results 500m–850m → 2 results 850m–1000m. If distance_m is null, distribute evenly.
4. RANKING ORDER — follow global ranker strictly:
   Tier 1 (satisfy completely first):
   → Primary goal match → Calorie target supportable from menu → Health conditions respected → Dietary restrictions respected
   Tier 2 (within Tier 1):
   → Within budget → Cuisine likes, avoids dislikes → Macro targets supportable → Within distance comfort
   Tier 3 (within Tier 2):
   → Comfort food available → Discovery pick if openness high
   Never sacrifice a higher tier for a lower one.
5. FRESHNESS — soft filter, never hard block:
   → Never visited → show first
   → Not visited in 14+ days → show next
   → Visited recently but high order_count → keep showing (user loves it)
   → Only hard block: no name → skip it
6. LEARNING — apply silently:
   → Infer mood: comfort / social / quick / exploratory
   → If same cuisine 3 visits in a row → gently break the streak
   → High order_count = user loves it → keep showing

Return ONLY this JSON, no markdown, no explanation:
{
  "user_context": {
    "name": "${user?.name || "User"}",
    "time": "${datetime}",
    "meal_moment": "${mealMoment}",
    "inferred_mood": "comfort | social | quick | exploratory"
  },
  "results": [
    {
      "rank": 1,
      "name": "",
      "cuisine": "",
      "distance_m": 0,
      "rating": 0.0,
      "place_id": "",
      "icon": "",
      "vicinity": "",
      "priceLevel": null,
      "openNow": true,
      "userRatingsTotal": 0,
      "menu_source": "Google businessMenus — verified",
      "freshness_tag": "new | fresh | X days ago | returning favourite",
      "tier1_match": "goal, calories, restrictions satisfied",
      "why_picked": "[user_profile] tier1+tier2 signal + [live] signal → why this restaurant right now"
    }
  ],
  "freshness_applied": true,
  "personalization_score": "high | medium | discovery"
}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: rankPrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Gemini error");
    }

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const result = JSON.parse(rawText);

    // Rebuild ranked list with full place data merged back in
    const placeMap = Object.fromEntries(restaurants.map(r => [r.id, r]));
    const rankedList = (result.results || []).map(r => {
      const original = placeMap[r.place_id] || {};
      return {
        ...original,
        rank: r.rank,
        freshness_tag: r.freshness_tag,
        tier1_match: r.tier1_match,
        why_picked: r.why_picked,
        inferred_mood: result.user_context?.inferred_mood,
      };
    });

    res.json({
      success: true,
      data: rankedList,
      user_context: result.user_context,
      personalization_score: result.personalization_score,
      freshness_applied: result.freshness_applied,
    });
  } catch (err) {
    console.error("Rank error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/restaurants/menu ────────────────────────────────
// Meal Concierge Engine v2 — ranked concierge recommendation + full menu
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

    let user = null;
    let recentLogs = [];

    if (userId) {
      try {
        [user, recentLogs] = await Promise.all([
          User.findById(userId),
          DailyLog.find({ userId }).sort({ date: -1 }).limit(14).lean(),
        ]);
      } catch (e) {
        console.error("User/history fetch failed:", e.message);
      }
    }

    const now = new Date();
    const datetime = now.toISOString();
    const hour = now.getHours();
    const day = now.toLocaleDateString("en-US", { weekday: "long" });
    const mealMoment = hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : hour < 22 ? "dinner" : "late-night";
    const calsPerMeal = user ? Math.round((user.dailyCalorieTarget || user.tdee || 2000) / 3) : 600;
    const budgetStr = user?.budget || "moderate";

    // Determine currency from user's saved location via reverse geocode
    let currencySymbol = "₹"; let currencyCode = "INR";
    if (user?.location?.lat && user?.location?.lng) {
      try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        const gcUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${user.location.lat},${user.location.lng}&key=${apiKey}`;
        const gcRes = await fetch(gcUrl);
        const gcData = await gcRes.json();
        if (gcData.status === "OK") {
          const comps = gcData.results?.[0]?.address_components || [];
          const country = comps.find((c) => c.types.includes("country"))?.long_name;
          if (country) ({ symbol: currencySymbol, code: currencyCode } = getCurrency(country));
        }
      } catch { /* keep default */ }
    }

    // Also get city/region for context
    let location = { city: "unknown", region: "unknown" };
    if (user?.location?.lat && user?.location?.lng) {
      try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        const gcUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${user.location.lat},${user.location.lng}&key=${apiKey}`;
        const gcRes = await fetch(gcUrl);
        const gcData = await gcRes.json();
        if (gcData.status === "OK") {
          const comps = gcData.results?.[0]?.address_components || [];
          const get = (t) => comps.find((c) => c.types.includes(t))?.long_name || "unknown";
          location = { city: get("locality") || get("administrative_area_level_2"), region: get("administrative_area_level_1") };
        }
      } catch { /* keep default */ }
    }

    // Build last 20 meals with restaurant + item detail
    const allMeals = recentLogs.flatMap((log) =>
      (log.meals || []).map((m) => ({
        restaurant: m.source?.split("·")[0]?.trim() || m.source || "unknown",
        item: m.name,
        cuisine: cuisine || "general",
        calories: m.calories,
        date: m.loggedAt,
      }))
    ).slice(0, 20);

    // Compute avg calories and avg spend per meal
    const avgCal = allMeals.length
      ? Math.round(allMeals.reduce((s, m) => s + (m.calories || 0), 0) / allMeals.length)
      : calsPerMeal;

    // Items from this restaurant in last 7 days (freshness block)
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const recentItems = allMeals
      .filter((m) => m.restaurant?.toLowerCase().includes(placeName.toLowerCase()) && new Date(m.date) > sevenDaysAgo)
      .map((m) => m.item);

    const conciergePrompt = `SYSTEM PROMPT — MEAL CONCIERGE ENGINE v2.0
You are a personal meal concierge. You don't suggest — you ORDER.
Given a chosen restaurant and its full menu, you build the perfect meal for this specific user, right now.
Think like a friend who knows exactly what they need and orders for them without asking.
[user_profile] and [live] are always ONE combined signal. Never split them.

INPUTS
------
[restaurant]:
- Name: ${placeName}
- Cuisine: ${cuisine || "general"}
- Price level: ${priceLevel ? "$".repeat(priceLevel) : "unknown"}
- Full menu: Use your knowledge of this restaurant's real menu. If it's a known chain, use actual menu items with real prices. If local, generate realistic items for this cuisine type with prices.
- Every menu item must have: name, description, price, category, calories, macros (protein_g, carbs_g, fat_g), macro_source
- CURRENCY: All price values must be in ${currencyCode} (${currencySymbol}). Use real local market prices for ${location?.city || "this region"}.

[user_profile] + [live]:
- Name: ${user?.name || "User"}
- Age: ${user?.age || "unknown"}
- Gender: ${user?.gender || "unknown"}
- Primary goal: ${user?.primaryGoal || "Maintain Weight"}
- Dietary restrictions: ${user?.restrictions || "none"}
- Food dislikes: ${user?.dislikes || "none"}
- Favourite foods: ${user?.favorites || "no specific preference"}
- Calorie target per meal: ${calsPerMeal} kcal
- Budget per meal: ${budgetStr}
- Time: ${datetime}
- Day: ${day}
- Meal moment: ${mealMoment}

[history]:
- Last 20 meals: ${JSON.stringify(allMeals)}
- Items from this restaurant in last 7 days (DO NOT repeat these): ${JSON.stringify(recentItems)}
- Avg calories per meal: ${avgCal} kcal
- Avg spend per meal: estimated from budget preference

RULES — NON NEGOTIABLE:
1. SOURCE → Only use items from [restaurant] menu. No invented or assumed items outside the menu.
2. RANKING ORDER — follow global ranker strictly:
   Tier 1 (satisfy completely first):
   → Supports primary goal → Calorie target not exceeded → Health conditions respected → Dietary restrictions — no exceptions
   Tier 2 (within Tier 1):
   → Total stays within budget → Matches cuisine and spice preference → Macro targets met as closely as possible
   Tier 3 (within Tier 2):
   → Comfort food on menu → consider it → New item user hasn't tried → introduce it
3. MACROS AND CALORIES → Estimate for every item using nutrition knowledge → Mark as "~estimated" always → If menu has official data → mark as "verified"
4. MEAL BALANCE — based on meal moment:
   → Lunch or dinner → main + side + drink
   → Light or low calorie → smaller main + zero cal drink
   → Snack → small bites only
   → Post workout → highest protein first
5. FRESHNESS → No item repeated from last 7 days → Introduce at least 1 new item where possible
6. NEVER FORCE → Concierge recommendation is a suggestion only → Full menu is always shown beneath it → User decides
7. tier1_safe flag → true only if item is safe for user's goal AND dietary restrictions

why_ordered — strict rule:
WRONG: "Healthy option"
WRONG: "User likes chicken"
RIGHT: "Primary goal weight loss + ${day} ${mealMoment} → grilled chicken keeps calories on target, high protein, first time ordering this"

concierge_note — strict rule:
One sentence. Talk like you know them. Personal. Direct. No fluff.
RIGHT: "Kept it light since you have been consistent this week"
RIGHT: "Big day ahead so loaded you up on protein"

OUTPUT SIZE LIMITS (STRICT — prevents truncation):
- full_menu: max 5 categories, max 8 items per category
- concierge_recommendation.items: max 3 items
- why_ordered: 1 sentence, max 100 characters
- description: max 80 characters
- concierge note: max 100 characters

Return ONLY this JSON, no markdown, no explanation:
{
  "user_context": {
    "name": "${user?.name || "User"}",
    "restaurant": "${placeName}",
    "meal_moment": "${mealMoment}",
    "inferred_mode": "calorie-controlled | high-protein | balanced | light"
  },
  "concierge_recommendation": {
    "note": "One line. Personal. Direct. No fluff.",
    "items": [
      {
        "category": "main | side | drink | dessert",
        "item": "Exact item name from menu",
        "price": 0.00,
        "calories": 0,
        "macros": { "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
        "macro_source": "~estimated | verified",
        "why_ordered": "Tier1+Tier2 signal + live signal → why this item right now"
      }
    ],
    "summary": {
      "total_calories": 0,
      "total_cost": 0.00,
      "within_budget": true,
      "within_calorie_target": true
    }
  },
  "full_menu": {
    "source": "~estimated from known menu | verified",
    "categories": [
      {
        "category_name": "Category from restaurant menu",
        "items": [
          {
            "item": "Exact item name",
            "description": "As listed on menu",
            "price": 0.00,
            "calories": 0,
            "macros": { "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
            "macro_source": "~estimated | verified",
            "tier1_safe": true
          }
        ]
      }
    ]
  }
}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: conciergePrompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 16384, responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Gemini error");
    }

    const geminiData = await response.json();

    // Check for finish reason — truncated output
    const finishReason = geminiData.candidates?.[0]?.finishReason;
    let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) throw new Error("Gemini returned empty response");

    // Attempt to repair truncated JSON by closing open structures
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn("JSON truncated, attempting repair. finishReason:", finishReason);
      // Try to find the last valid closing brace/bracket pair
      // Close any open arrays then objects
      let repaired = rawText.trimEnd();
      // Count unclosed brackets
      let opens = 0;
      for (const ch of repaired) { if (ch === "{" || ch === "[") opens++; else if (ch === "}" || ch === "]") opens--; }
      // Remove trailing comma if present before we close
      repaired = repaired.replace(/,\s*$/, "");
      // Close unclosed structures (rough heuristic)
      const stack = [];
      for (const ch of repaired) { if (ch === "{") stack.push("}"); else if (ch === "[") stack.push("]"); else if (ch === "}" || ch === "]") stack.pop(); }
      repaired += stack.reverse().join("");
      try {
        result = JSON.parse(repaired);
        console.log("JSON repair succeeded");
      } catch {
        throw new Error("Gemini response was truncated and could not be repaired. Try again.");
      }
    }

    // Normalize to a consistent shape the frontend expects
    const normalized = {
      user_context: result.user_context,
      // New fields (v2)
      concierge_recommendation: result.concierge_recommendation,
      full_menu: result.full_menu,
      // Legacy compat fields mapped from v2 structure
      recommended_order: (result.concierge_recommendation?.items || []).map((i) => ({
        item: i.item,
        category: i.category,
        price: i.price,
        calories: i.calories,
        macros: i.macros,
        macro_source: i.macro_source,
        why_ordered: i.why_ordered,
      })),
      order_summary: result.concierge_recommendation?.summary || {},
      concierge_note: result.concierge_recommendation?.note || "",
      menu: {
        categories: (result.full_menu?.categories || []).map((cat) => ({
          name: cat.category_name,
          items: (cat.items || []).map((it) => ({
            name: it.item,
            description: it.description,
            price: it.price,
            calories: it.calories,
            protein: it.macros?.protein_g || 0,
            carbs: it.macros?.carbs_g || 0,
            fat: it.macros?.fat_g || 0,
            macro_source: it.macro_source,
            tier1_safe: it.tier1_safe,
          })),
        })),
      },
    };

    // Cache it
    menuCache[placeId] = normalized;

    res.json({ success: true, data: normalized, cached: false, currency: { symbol: currencySymbol, code: currencyCode } });
  } catch (err) {
    console.error("Menu error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;