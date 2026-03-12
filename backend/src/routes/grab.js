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
      generationConfig: { temperature: 0.8, maxOutputTokens: 16384, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) throw new Error("Gemini error: " + response.status);

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    return JSON.parse(raw);
  } catch {
    // Repair truncated JSON
    let repaired = raw.trimEnd().replace(/,\s*$/, "");
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

// ── POST /api/grab/items ──────────────────────────────────────
router.post("/items", async (req, res) => {
  try {
    const { userId, lat: bodyLat, lng: bodyLng } = req.body;

    let user = null;
    let recentLogs = [];

    if (userId) {
      try {
        [user, recentLogs] = await Promise.all([
          User.findById(userId),
          DailyLog.find({ userId }).sort({ date: -1 }).limit(10).lean(),
        ]);
      } catch (e) { console.error("User fetch error:", e.message); }
    }

    const lat = bodyLat || user?.location?.lat;
    const lng = bodyLng || user?.location?.lng;

    console.log(`🛒 Grab location — bodyLat:${bodyLat} bodyLng:${bodyLng} userDB:${user?.location?.lat},${user?.location?.lng} → using:${lat},${lng}`);

    // Reverse geocode for precise location context
    const location = await reverseGeocode(lat, lng);

    // Currency: use geocoded country, fall back to India if location unknown
    const resolvedCountry = location.country !== "unknown" ? location.country : "India";
    const { symbol: currencySymbol, code: currencyCode } = getCurrency(resolvedCountry);
    console.log(`🛒 Grab → country:"${location.country}" resolved:"${resolvedCountry}" → currency:${currencySymbol} (${currencyCode})`);

    const now = new Date();
    const datetime = now.toISOString();
    const hour = now.getHours();
    const day = now.toLocaleDateString("en-US", { weekday: "long" });
    const consumptionMoment = hour < 11 ? "morning" : hour < 15 ? "midday" : hour < 18 ? "evening" : "late-night";
    const calsPerSnack = user ? Math.round((user.dailyCalorieTarget || 2000) / 5) : 400;

    // Build last 20 picked items with brand/product detail
    const last20 = recentLogs
      .flatMap((log) => (log.meals || []).map((m) => ({
        brand: m.name?.split(" ")?.[0] || m.name,
        product: m.name,
        category: m.source || "unknown",
        date: m.loggedAt,
      })))
      .slice(0, 20);

    const lastCategories = [...new Set(last20.map((m) => m.category).filter(Boolean))].slice(0, 5);

    const prompt = `ROLE
You find real purchasable ready-to-eat items for this specific person right now.
No cooking. No prep. Pick it up and consume it.
One job. Apply location filter first. Apply global ranker second. Return 5 categories of 5 real products each.

⚠️ CURRENCY RULE — NON NEGOTIABLE: All price_approx values MUST be in ${currencyCode} (${currencySymbol}). Never use USD or $ symbols. Use ${currencySymbol} only.

INPUTS
------
[user_profile] + [live] — always ONE signal, never separate:
- Name: ${user?.name || "User"}
- Age: ${user?.age || "unknown"}
- Gender: ${user?.gender || "unknown"}
- Primary goal: ${user?.primaryGoal || "Maintain Weight"}
- Dietary restrictions: ${user?.restrictions || "none"}
- Food dislikes: ${user?.dislikes || "none"}
- Calorie target per snack: ${calsPerSnack} kcal
- Budget: ${user?.budget || "moderate"}
- GPS: ${lat || "unknown"}, ${lng || "unknown"}
- Time: ${datetime}
- Day: ${day}
- Location: ${location.city}, ${location.region}, ${location.country}
- Consumption moment: ${consumptionMoment}

[history]:
- Last 20 items picked: ${JSON.stringify(last20)}
- Most picked categories: ${JSON.stringify(lastCategories)}

LOCATION FILTER — RUNS BEFORE ANYTHING ELSE:
Step 1 → Identify region and country from live location. Understand what brands and product categories are actually sold in that market.
  Kerala → local brands like Britannia, Parle, ITC, fresh cut fruits, coconut water, regional snacks
  Karnataka/Bangalore → MTR, Britannia, Parle, Lays, fresh juices, local bakery items, protein bars from health stores
  Punjab → local dairy, Amul, regional sweets, Parle, ITC snacks
  Germany → Haribo, Ritter Sport, Alpro, local brands
  USA → Clif, Kind, Grenade, widely available chains
  Apply this logic for any region globally.
Step 2 → Identify nearby supermarkets from GPS. Large supermarket → broad range. Local convenience → limited brands. Use this to filter further.
Step 3 → Build availability profile for this exact location. Only suggest products that exist in stores near them. If unsure → skip it.
Step 4 → Price check. Prices must reflect what that product costs in that specific region, not global average.
         Currency: ${currencySymbol} (${currencyCode}) — all price_approx values must be in ${currencyCode}.

RULES — NON NEGOTIABLE:
1. SOURCE → Real products only. Full brand name + exact product name + exact flavor or variant. No generic items. Every product must exist in stores near user's location.
2. RANKING ORDER:
   Tier 1 (satisfy completely first):
   → Location confirmed product exists nearby → Supports primary goal → Calorie target not exceeded → Dietary restrictions — no exceptions
   Tier 2 (within Tier 1):
   → Within budget at local store prices → Matches taste profile → Macro targets met
   Tier 3 (within Tier 2):
   → Comfort product → Discovery pick user hasn't tried before
3. SINGLE SERVE ONLY → Individual size only. Not family pack. One person opens it and finishes it now.
4. FORMAT → Exactly 5 categories. Exactly 5 items per category. 25 items total always. Every category must be distinct.
5. FRESHNESS → No item repeated from history. No category repeated from last session. At least 1 wildcard category. Categories rotate every session.
6. EVERY ITEM MUST HAVE → Price at local market rate. Calories per single serve. Macros protein carbs fat.

OUTPUT SIZE LIMITS (prevents truncation):
- Exactly 5 categories, exactly 5 items each = 25 items total
- why_picked: max 1 sentence, 120 characters
- category_note: max 80 characters
- curator_note: max 100 characters
- variant: exact single-serve size/flavor only

why_picked — strict rule:
WRONG: "Healthy snack option"
WRONG: "User likes chocolate"
RIGHT: "Primary goal weight loss + post gym ${day} ${location.region} → Britannia NutriChoice, available at nearest supermarket, under calorie target, never picked before"

curator_note — strict rule:
One sentence. Talk like you know them.
RIGHT: "Grab the protein bar first, it is exactly what you need right now"
RIGHT: "Start with the coconut water, everything else is a bonus"

Return ONLY this JSON, no markdown, no explanation:
{
  "user_context": {
    "name": "${user?.name || "User"}",
    "location": "${location.city}, ${location.region}",
    "nearby_stores": "inferred store types near ${location.city}",
    "consumption_moment": "${consumptionMoment}",
    "inferred_mode": "calorie-controlled | indulgence | high-protein | light"
  },
  "availability_region": "brief description of what products/brands are available in this region",
  "grocery_list": [
    {
      "category": "Category Name",
      "category_note": "Why this category fits this person right now",
      "items": [
        {
          "rank": 1,
          "brand": "",
          "product": "",
          "variant": "single serve size",
          "price_approx": 0.00,
          "calories": 0,
          "macros": { "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
          "available_nearby": true,
          "why_picked": "tier1+tier2 signal + live location signal → why this product right now"
        }
      ]
    }
  ],
  "session_summary": {
    "total_categories": 5,
    "total_items": 25,
    "estimated_total_if_all_bought": 0.00,
    "freshness_applied": true,
    "new_category_introduced": "Category name"
  },
  "curator_note": "One line. Personal. Direct. What to grab first and why."
}`;

    const result = await callGemini(prompt);
    res.json({ success: true, data: result, currency: { symbol: currencySymbol, code: currencyCode } });
  } catch (err) {
    console.error("Grab error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;