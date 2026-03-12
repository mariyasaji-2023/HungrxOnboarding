import { useState, useEffect, useRef } from "react";

// ── RTL cursor fix ───────────────────────────────────────────────────────────
const useRtlString = (setValue) => {
  const ref = useRef(null);
  const onChange = (e) => {
    const val = e.target.value;
    setValue(val);
    setTimeout(() => {
      const el = ref.current;
      if (el) { const len = el.value.length; el.setSelectionRange(len, len); }
    }, 0);
  };
  return { ref, onChange };
};

const extractNum = (str) => {
  const m = String(str).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
};

// ── EditCard ─────────────────────────────────────────────────────────────────
const EditCard = ({ item, onDone, onRemove }) => {
  const [name, setName] = useState(item.name);
  const [portion, setPortion] = useState(item.portion);
  const [calories, setCalories] = useState(String(item.calories));
  const [calEdited, setCalEdited] = useState(false);
  const baseCalories = useRef(item.calories);
  const basePortion = useRef(extractNum(item.portion));
  const nameRtl = useRtlString(setName);
  const portionRtl = useRtlString((v) => {
    setPortion(v);
    if (!calEdited) {
      const base = basePortion.current;
      const newNum = extractNum(v);
      if (base && base > 0 && newNum && newNum > 0)
        setCalories(String(Math.round(baseCalories.current * (newNum / base))));
    }
  });
  const calRtl = useRtlString((v) => { setCalories(v.replace(/[^0-9]/g, "")); setCalEdited(true); });
  const unit = item.portion.replace(/[\d.]+\s*/g, "").trim() || "";
  const inp = { background: "#1e1e1e", border: "1px solid #3e3e42", borderRadius: "4px", outline: "none", fontFamily: "'JetBrains Mono', monospace", padding: "9px 10px", direction: "ltr", textAlign: "left", width: "100%" };
  return (
    <div style={{ background: "#252526", border: "1px solid #569cd6", borderRadius: "6px", overflow: "hidden", fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ padding: "13px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a2a2a" }}>
        <span style={{ fontSize: "12px", color: "#d4d4d4" }}>{item.name}</span>
        <span style={{ fontSize: "9px", color: "#569cd6", letterSpacing: "0.08em" }}>editing</span>
      </div>
      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "8px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "5px" }}>NAME</div>
          <input ref={nameRtl.ref} dir="ltr" value={name} onChange={nameRtl.onChange} onKeyDown={e => e.stopPropagation()} style={{ ...inp, color: "#d4d4d4", fontSize: "13px" }} />
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "8px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "5px" }}>PORTION {unit ? <span style={{ color: "#858585", fontSize: "8px" }}>({unit})</span> : ""}</div>
            <input ref={portionRtl.ref} dir="ltr" value={portion} onChange={portionRtl.onChange} onKeyDown={e => e.stopPropagation()} style={{ ...inp, color: "#d4d4d4", fontSize: "12px" }} />
          </div>
          <div style={{ width: "84px" }}>
            <div style={{ fontSize: "8px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "5px" }}>CALORIES</div>
            <input ref={calRtl.ref} dir="ltr" inputMode="numeric" value={calories} onChange={calRtl.onChange} onKeyDown={e => e.stopPropagation()} style={{ ...inp, color: "#bada55", fontSize: "14px" }} />
          </div>
        </div>
        {!calEdited && basePortion.current
          ? <div style={{ fontSize: "8px", color: "#858585", marginBottom: "12px" }}>// calories scale automatically with portion</div>
          : calEdited && <button onClick={() => { setCalEdited(false); const n = extractNum(portion); const b = basePortion.current; if (b && n) setCalories(String(Math.round(baseCalories.current * (n / b)))); }} style={{ background: "none", border: "none", color: "#569cd6", fontSize: "8px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", marginBottom: "12px", padding: 0 }}>// reset to auto-scale</button>
        }
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => onDone({ ...item, name, portion, calories: parseInt(calories || "0", 10) })} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid #bada55", borderRadius: "4px", color: "#bada55", fontSize: "11px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>done</button>
          <button onClick={onRemove} style={{ padding: "10px 16px", background: "transparent", border: "1px solid #f48771", borderRadius: "4px", color: "#f48771", fontSize: "11px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>remove</button>
        </div>
      </div>
    </div>
  );
};

// ── useLogFeature ────────────────────────────────────────────────────────────
const useLogFeature = (addItem, setCurrentView) => {
  const [logParsing, setLogParsing] = useState(false);
  const [logError, setLogError] = useState("");
  const [logResults, setLogResults] = useState([]);
  const [logSelected, setLogSelected] = useState({});
  const [logInput, setLogInput] = useState("");
  const [logConfirmed, setLogConfirmed] = useState(false);
  const [logEditing, setLogEditing] = useState(null);
  const logRtl = useRtlString((v) => { setLogInput(v); setLogError(""); if (logResults.length > 0) { setLogResults([]); setLogSelected({}); } });
  const logInputRef = logRtl.ref;
  const parseLog = async () => {
    if (!logInput.trim() || logParsing) return;
    setLogParsing(true); setLogError(""); setLogResults([]); setLogConfirmed(false);
    try {
      const response = await fetch(`http://localhost:5000/api/logparse/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: logInput }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      const items = data.items;
      const sel = {}; items.forEach((_, i) => (sel[i] = true));
      setLogSelected(sel); setLogResults(items);
    } catch { setLogError("Couldn't read that — try rewording it."); }
    finally { setLogParsing(false); }
  };
  const confirmLog = () => {
    logResults.forEach((item, i) => { if (logSelected[i]) addItem(item, "AI Log"); });
    setLogConfirmed(true);
    setTimeout(() => { setLogInput(""); setLogResults([]); setLogSelected({}); setLogConfirmed(false); setCurrentView("main"); }, 1200);
  };
  const resetLog = () => {
    setLogInput(""); setLogResults([]); setLogSelected({}); setLogError("");
    setLogParsing(false); setLogConfirmed(false); setLogEditing(null);
    setTimeout(() => logInputRef.current?.focus(), 80);
  };
  return { logParsing, logError, logResults, setLogResults, logSelected, setLogSelected, logInput, logConfirmed, logEditing, setLogEditing, logRtl, logInputRef, parseLog, confirmLog, resetLog };
};

// ── LogView ──────────────────────────────────────────────────────────────────
const LogView = ({ log, setCurrentView }) => {
  const { logParsing, logError, logResults, setLogResults, logSelected, setLogSelected, logInput, logConfirmed, logEditing, setLogEditing, logRtl, logInputRef, parseLog, confirmLog, resetLog } = log;
  const hour = new Date().getHours();
  const meal = hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : "dinner";
  const hasResults = logResults.length > 0 && !logParsing;
  const selectedItems = logResults.filter((_, i) => logSelected[i]);
  const totalCals = selectedItems.reduce((s, item) => s + item.calories, 0);
  const btn = hasResults
    ? logConfirmed ? { label: `✓  +${totalCals} cal logged`, color: "#6ec46e", border: "#6ec46e", action: null } : { label: "confirm →", color: "#bada55", border: "#bada55", action: confirmLog }
    : logInput.trim() && !logParsing ? { label: "calculate →", color: "#bada55", border: "#bada55", action: parseLog }
    : { label: "start typing...", color: "#3e3e42", border: "#3e3e42", action: null };
  return (
    <div style={{ position: "absolute", inset: 0, background: "#1e1e1e", borderRadius: "inherit", display: "flex", flexDirection: "column", padding: "0 28px 32px", zIndex: 10, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "24px", paddingBottom: "28px", flexShrink: 0 }}>
        <span style={{ fontSize: "10px", color: "#569cd6", letterSpacing: "0.08em" }}><span style={{ color: "#858585" }}>// </span>{meal}</span>
        <button onClick={() => { resetLog(); setCurrentView("options"); }} style={{ background: "none", border: "none", color: "#555", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: "28px", color: "#d4d4d4", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: "8px", flexShrink: 0 }}>what did<br />you eat?</div>
      <div style={{ fontSize: "10px", color: "#569cd6", marginBottom: "24px", letterSpacing: "0.03em", flexShrink: 0 }}><span style={{ color: "#858585" }}>// </span>type naturally — include amounts for better accuracy</div>
      <textarea
        ref={logInputRef} value={logInput} dir="ltr" onChange={logRtl.onChange}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !hasResults && logEditing === null) { e.preventDefault(); parseLog(); } }}
        placeholder={"a bowl of oats, banana,\nblack coffee, two eggs..."} rows={hasResults ? 2 : 4}
        disabled={logParsing || logConfirmed}
        style={{ background: "transparent", border: "none", outline: "none", color: "#bada55", fontSize: "16px", fontFamily: "'JetBrains Mono', monospace", resize: "none", lineHeight: 1.75, direction: "ltr", textAlign: "left", opacity: logParsing || logConfirmed ? 0.4 : 1, transition: "opacity 0.2s ease", width: "100%", flexShrink: 0 }}
      />
      {logParsing && (
        <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em" }}>// calculating</span>
          <div style={{ display: "flex", gap: "4px" }}>{[0,1,2].map((i) => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#bada55", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
        </div>
      )}
      {hasResults && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
          <div style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em", marginBottom: "4px" }}>// tap to edit</div>
          {logResults.map((item, i) => logEditing === i
            ? <EditCard key={i} item={item}
                onDone={(updated) => { setLogResults(prev => prev.map((it, idx) => idx === i ? updated : it)); setLogEditing(null); }}
                onRemove={() => { setLogResults(prev => prev.filter((_, idx) => idx !== i)); setLogSelected(prev => { const n = {}; Object.keys(prev).forEach(k => { const ki = Number(k); if (ki < i) n[ki] = prev[k]; else if (ki > i) n[ki-1] = prev[k]; }); return n; }); setLogEditing(null); }}
              />
            : <div key={i} onClick={() => setLogEditing(i)} style={{ padding: "13px 14px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "6px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", color: "#d4d4d4", marginBottom: "2px" }}>{item.name}</div>
                  <div style={{ fontSize: "9px", color: "#858585" }}>{item.portion}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "14px", color: "#bada55" }}>{item.calories}</span>
                  <span style={{ color: "#3e3e42", fontSize: "12px" }}>›</span>
                </div>
              </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 2px", borderTop: "1px solid #2a2a2a", marginTop: "2px" }}>
            <span style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.08em" }}>// total</span>
            <span style={{ fontSize: "18px", color: "#bada55" }}>{totalCals} <span style={{ fontSize: "10px", color: "#858585" }}>cal</span></span>
          </div>
        </div>
      )}
      {logError && <div style={{ fontSize: "10px", color: "#f48771", marginTop: "12px", letterSpacing: "0.04em", flexShrink: 0 }}><span style={{ color: "#858585" }}>// </span>{logError}</div>}
      <div style={{ flex: 1, minHeight: "20px" }} />
      <button onClick={btn.action || undefined} disabled={!btn.action} style={{ width: "100%", padding: "18px", background: "transparent", border: `1px solid ${btn.border}`, borderRadius: "8px", color: btn.color, fontSize: "13px", fontWeight: 500, cursor: btn.action ? "pointer" : "default", fontFamily: "'JetBrains Mono', monospace", transition: "border-color 0.25s ease, color 0.25s ease", letterSpacing: "0.04em", flexShrink: 0 }}>{btn.label}</button>
    </div>
  );
};

const BACKEND_URL = "http://localhost:5000";

const HungrXDashboard = ({ userData = {}, onLogout }) => {
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalFat, setTotalFat] = useState(0);
  const [mealHistory, setMealHistory] = useState([]);
  const [logLoading, setLogLoading] = useState(true);
  const [currentView, setCurrentView] = useState("main");
  const [currentRestaurant, setCurrentRestaurant] = useState(null);
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [currentTime, setCurrentTime] = useState("");

  // ── Gemini cook() state ───────────────────────────────────────
  const [geminiRecipes, setGeminiRecipes] = useState([]);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState("");
  const [geminiDetail, setGeminiDetail] = useState(null);
  const [geminiAvailabilityRegion, setGeminiAvailabilityRegion] = useState("");

  const [userLocation, setUserLocation] = useState(null);
  const [userCurrency, setUserCurrency] = useState("₹"); // default, updated after geocode

  // Derive currency symbol from country name
  const getCurrencySymbol = (country) => {
    const map = {
      "India": "₹", "United States": "$", "United Kingdom": "£",
      "European Union": "€", "Germany": "€", "France": "€", "Italy": "€",
      "Spain": "€", "Netherlands": "€", "Portugal": "€", "Belgium": "€",
      "Austria": "€", "Ireland": "€", "Greece": "€", "Finland": "€",
      "Japan": "¥", "China": "¥", "South Korea": "₩",
      "Australia": "A$", "Canada": "C$", "New Zealand": "NZ$",
      "Switzerland": "CHF", "Sweden": "kr", "Norway": "kr", "Denmark": "kr",
      "Brazil": "R$", "Mexico": "MX$", "Singapore": "S$",
      "United Arab Emirates": "AED", "Saudi Arabia": "SAR",
      "South Africa": "R", "Nigeria": "₦", "Kenya": "KSh",
      "Pakistan": "₨", "Bangladesh": "৳", "Sri Lanka": "Rs",
      "Thailand": "฿", "Indonesia": "Rp", "Malaysia": "RM",
      "Philippines": "₱", "Vietnam": "₫",
      "Russia": "₽", "Turkey": "₺", "Argentina": "AR$",
    };
    return map[country] || "$";
  };

  // ── grab() state ─────────────────────────────────────────────
  const [grabData, setGrabData] = useState(null);
  const [grabCurrency, setGrabCurrency] = useState(userCurrency);
  const [grabLoading, setGrabLoading] = useState(false);
  const [grabError, setGrabError] = useState("");

  // ── Menu cache — keyed by placeId, never refetched ──────────
  const [menuCache, setMenuCache] = useState({});
  const [menuLoading, setMenuLoading] = useState(false);

  // ── Nearby restaurants state ─────────────────────────────────
  const [nearbyRestaurants, setNearbyRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [restaurantsError, setRestaurantsError] = useState("");
  const [locationDenied, setLocationDenied] = useState(false);
  const [rankContext, setRankContext] = useState(null);

  const tdeeCalories = userData?.dailyCalorieTarget || userData?.tdee || 2000;
  const proteinTarget = userData?.macroTargets?.protein || Math.round((tdeeCalories * 0.3) / 4);
  const carbsTarget   = userData?.macroTargets?.carbs   || Math.round((tdeeCalories * 0.4) / 4);
  const fatTarget     = userData?.macroTargets?.fat     || Math.round((tdeeCalories * 0.3) / 9);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const t = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "");
      setCurrentTime(t);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Load today's log from DB on mount ────────────────────────
  useEffect(() => {
    const userId = localStorage.getItem("hungrxUserId");
    if (!userId) { setLogLoading(false); return; }
    fetch(`${BACKEND_URL}/api/logs/${userId}?tz=${new Date().getTimezoneOffset()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data;
          setTotalCalories(d.totalCalories || 0);
          setTotalProtein(d.totalProtein || 0);
          setTotalCarbs(d.totalCarbs || 0);
          setTotalFat(d.totalFat || 0);
          setMealHistory((d.meals || []).map((m) => ({
            _id: m._id,
            name: m.name,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            source: m.source,
            timestamp: new Date(m.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLogLoading(false));
  }, []);

  // ── Silently get location on mount, save to DB once ─────────
  useEffect(() => {
    const userId = localStorage.getItem("hungrxUserId");
    if (!userId || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        // Reverse geocode to get currency
        try {
          const apiKey = ""; // uses backend — just infer from profile location
          const geoRes = await fetch(`${BACKEND_URL}/api/users/${userId}`);
          const geoJson = await geoRes.json();
          if (geoJson.success && geoJson.data?.location) {
            // We'll get country from geocode via a lightweight approach
            const gcRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const gcData = await gcRes.json();
            const country = gcData?.address?.country;
            if (country) setUserCurrency(getCurrencySymbol(country));
          }
        } catch { /* silent fail — keep default */ }

        // Save to DB
        try {
          await fetch(`${BACKEND_URL}/api/users/${userId}/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
        } catch (e) { /* silent fail */ }
      },
      () => { /* location denied — no action */ },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  // ── Fetch 10 recipes from Gemini ──────────────────────────────
  // Fetch 10 recipes from backend (which calls Gemini securely)
  const fetchGeminiRecipes = async () => {
    const userId = localStorage.getItem("hungrxUserId");
    setGeminiLoading(true);
    setGeminiError("");
    setGeminiRecipes([]);
    setGeminiDetail(null);
    setGeminiAvailabilityRegion("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/cook/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed");
      setGeminiRecipes(json.data.recipes || []);
      setGeminiAvailabilityRegion(json.data.availability_region || "");
      setGeminiError("");
    } catch (e) {
      setGeminiError(e.message || "Failed to load recipes. Tap retry.");
    } finally {
      setGeminiLoading(false);
    }
  };

  // Instantly show full recipe from already-loaded data — no second API call
  const fetchGeminiDetail = (recipe) => {
    setGeminiDetail({
      name: recipe.name,
      cuisine: recipe.cuisine,
      cook_time_mins: recipe.cook_time_mins,
      calories: recipe.calories_approx,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
      source: recipe.source || "",
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      cook_note: recipe.cook_note || "",
    });
    setCurrentView("cookDetail");
  };


  // ── Fetch AI grab items ──────────────────────────────────────
  const fetchGrabItems = async () => {
    setGrabLoading(true);
    setGrabError("");
    setGrabData(null);
    try {
      const userId = localStorage.getItem("hungrxUserId");
      const res = await fetch(`${BACKEND_URL}/api/grab/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, lat: userLocation?.lat, lng: userLocation?.lng }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed");
      if (json.currency?.symbol) { setUserCurrency(json.currency.symbol); setGrabCurrency(json.currency.symbol); }
      setGrabData(json.data);
    } catch (e) {
      setGrabError(e.message || "Failed to load. Tap retry.");
    } finally {
      setGrabLoading(false);
    }
  };

  // ── Open restaurant — instant if pre-fetched, else fetch now ─
  const openRestaurant = async (restaurant) => {
    setCurrentRestaurant(restaurant);
    setExpandedCategory(null);
    setCurrentView("menu");

    // Already cached from background pre-fetch — instant, no loading
    if (menuCache[restaurant.id]) return;

    // Not cached yet (still loading in background) — show loader and wait
    setMenuLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/restaurants/menu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: restaurant.id,
          placeName: restaurant.name,
          priceLevel: restaurant.priceLevel,
          cuisine: restaurant.types?.[0] || "",
          userId: localStorage.getItem("hungrxUserId"),
          lat: userLocation?.lat,
          lng: userLocation?.lng,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.currency?.symbol) setUserCurrency(json.currency.symbol);
        setMenuCache((prev) => ({ ...prev, [restaurant.id]: json.data }));
      }
    } catch (e) {
      console.error("Menu fetch failed:", e.message);
    } finally {
      setMenuLoading(false);
    }
  };

  // ── Fetch real nearby restaurants (localStorage cache + 24hr expiry) ──
  const fetchNearbyRestaurants = () => {
    setRestaurantsLoading(true);
    setRestaurantsError("");
    setLocationDenied(false);
    setRankContext(null);

    if (!navigator.geolocation) {
      setRestaurantsError("Geolocation not supported by your browser.");
      setRestaurantsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });

          const cached = JSON.parse(localStorage.getItem("hungrx_restaurants") || "null");
          const now = Date.now();
          const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
          const sameLocation = cached &&
            Math.abs(cached.lat - latitude) < 0.001 &&
            Math.abs(cached.lng - longitude) < 0.001;
          const notExpired = cached && (now - cached.savedAt) < TWENTY_FOUR_HOURS;

          if (sameLocation && notExpired) {
            console.log("📦 Restaurants from cache — no API call");
            setNearbyRestaurants(cached.list);
            setRankContext(cached.rankContext || null);
            setRestaurantsLoading(false);
            return;
          }

          console.log("🌐 Fetching fresh restaurants");
          const userId = localStorage.getItem("hungrxUserId");
          if (userId) {
            fetch(`${BACKEND_URL}/api/users/${userId}/location`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: latitude, lng: longitude }),
            }).catch(() => {});
          }

          // Step 1 — fetch from Google via backend
          const res = await fetch(`${BACKEND_URL}/api/restaurants/nearby`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude, radius: 1500 }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || "Failed to fetch restaurants.");

          const rawList = json.data || [];
          if (rawList.length === 0) {
            setRestaurantsError("No restaurants found nearby.");
            setRestaurantsLoading(false);
            return;
          }

          // Step 2 — rank + personalize via Gemini ranker
          console.log("🧠 Ranking restaurants with Gemini...");
          let finalList = rawList;
          let ctx = null;
          try {
            const rankRes = await fetch(`${BACKEND_URL}/api/restaurants/rank`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurants: rawList, userId, lat: latitude, lng: longitude }),
            });
            const rankJson = await rankRes.json();
            if (rankJson.success && rankJson.data?.length > 0) {
              finalList = rankJson.data;
              ctx = rankJson.user_context || null;
              setRankContext({ ...ctx, personalization_score: rankJson.personalization_score });
            }
          } catch (e) {
            console.warn("Ranking failed, using raw list:", e.message);
          }

          setNearbyRestaurants(finalList);
          localStorage.setItem("hungrx_restaurants", JSON.stringify({
            list: finalList, lat: latitude, lng: longitude, savedAt: now, rankContext: ctx,
          }));
        } catch (e) {
          setRestaurantsError("Failed to fetch restaurants: " + e.message);
        } finally {
          setRestaurantsLoading(false);
        }
      },
      (err) => {
        setRestaurantsLoading(false);
        if (err.code === 1) {
          setLocationDenied(true);
          setRestaurantsError("Location access denied. Please allow location in your browser.");
        } else {
          setRestaurantsError("Could not get your location. Please try again.");
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const restaurants = [
    { id: 1, name: "McDonald's", icon: "M" },
    { id: 2, name: "KFC", icon: "K" },
    { id: 3, name: "Subway", icon: "S" },
    { id: 4, name: "Burger King", icon: "B" },
    { id: 5, name: "Domino's", icon: "D" },
    { id: 6, name: "Pizza Hut", icon: "P" },
    { id: 7, name: "Starbucks", icon: "S" },
    { id: 8, name: "Taco Bell", icon: "T" },
    { id: 9, name: "Wendy's", icon: "W" },
    { id: 10, name: "Chipotle", icon: "C" },
  ];

  const menus = {
    1: [
      { name: "Big Mac", calories: 563, category: "Burgers", protein: 25, carbs: 45, fat: 30 },
      { name: "Quarter Pounder", calories: 520, category: "Burgers", protein: 30, carbs: 42, fat: 26 },
      { name: "McChicken", calories: 400, category: "Burgers", protein: 14, carbs: 39, fat: 21 },
      { name: "Filet-O-Fish", calories: 380, category: "Burgers", protein: 15, carbs: 39, fat: 18 },
      { name: "Medium Fries", calories: 340, category: "Sides", protein: 4, carbs: 44, fat: 16 },
      { name: "McNuggets (6pc)", calories: 250, category: "Sides", protein: 15, carbs: 16, fat: 15 },
      { name: "McFlurry", calories: 510, category: "Desserts", protein: 13, carbs: 76, fat: 16 },
      { name: "Coca-Cola (Medium)", calories: 210, category: "Drinks", protein: 0, carbs: 58, fat: 0 },
    ],
    2: [
      { name: "Original Recipe Chicken", calories: 320, category: "Chicken", protein: 29, carbs: 10, fat: 19 },
      { name: "Zinger Burger", calories: 550, category: "Burgers", protein: 24, carbs: 55, fat: 26 },
      { name: "Popcorn Chicken", calories: 400, category: "Chicken", protein: 19, carbs: 28, fat: 24 },
      { name: "Coleslaw", calories: 150, category: "Sides", protein: 1, carbs: 21, fat: 7 },
      { name: "Mashed Potatoes", calories: 120, category: "Sides", protein: 2, carbs: 18, fat: 4 },
      { name: "Biscuit", calories: 180, category: "Sides", protein: 2, carbs: 20, fat: 10 },
    ],
    3: [
      { name: "Italian BMT", calories: 410, category: "Subs", protein: 19, carbs: 45, fat: 16 },
      { name: "Turkey Breast", calories: 280, category: "Subs", protein: 18, carbs: 46, fat: 3 },
      { name: "Chicken Teriyaki", calories: 370, category: "Subs", protein: 25, carbs: 59, fat: 5 },
      { name: "Veggie Delite", calories: 230, category: "Subs", protein: 9, carbs: 44, fat: 2 },
      { name: "Meatball Marinara", calories: 480, category: "Subs", protein: 21, carbs: 61, fat: 17 },
      { name: "Tuna", calories: 450, category: "Subs", protein: 20, carbs: 45, fat: 21 },
    ],
    4: [
      { name: "Whopper", calories: 657, category: "Burgers", protein: 28, carbs: 49, fat: 40 },
      { name: "Chicken Royale", calories: 670, category: "Burgers", protein: 28, carbs: 54, fat: 40 },
      { name: "Bacon King", calories: 1040, category: "Burgers", protein: 57, carbs: 49, fat: 68 },
      { name: "Chicken Nuggets (10pc)", calories: 430, category: "Sides", protein: 20, carbs: 27, fat: 27 },
      { name: "Onion Rings", calories: 410, category: "Sides", protein: 5, carbs: 53, fat: 20 },
      { name: "Hershey's Sundae", calories: 310, category: "Desserts", protein: 7, carbs: 50, fat: 10 },
    ],
    5: [
      { name: "Pepperoni Pizza (Slice)", calories: 298, category: "Pizza", protein: 13, carbs: 36, fat: 11 },
      { name: "Margherita Pizza (Slice)", calories: 210, category: "Pizza", protein: 9, carbs: 27, fat: 7 },
      { name: "Chicken BBQ Pizza (Slice)", calories: 265, category: "Pizza", protein: 12, carbs: 31, fat: 10 },
      { name: "Veggie Pizza (Slice)", calories: 230, category: "Pizza", protein: 10, carbs: 28, fat: 8 },
      { name: "Garlic Bread", calories: 150, category: "Sides", protein: 4, carbs: 20, fat: 6 },
      { name: "Chicken Wings (6pc)", calories: 470, category: "Sides", protein: 44, carbs: 12, fat: 28 },
    ],
    6: [
      { name: "Meat Lovers (Slice)", calories: 340, category: "Pizza", protein: 16, carbs: 29, fat: 18 },
      { name: "Veggie Supreme (Slice)", calories: 220, category: "Pizza", protein: 10, carbs: 30, fat: 7 },
      { name: "Hawaiian Pizza (Slice)", calories: 250, category: "Pizza", protein: 12, carbs: 30, fat: 9 },
      { name: "Pepperoni (Slice)", calories: 290, category: "Pizza", protein: 13, carbs: 28, fat: 14 },
      { name: "Breadsticks", calories: 140, category: "Sides", protein: 4, carbs: 20, fat: 5 },
      { name: "Pasta Alfredo", calories: 520, category: "Pasta", protein: 18, carbs: 55, fat: 24 },
    ],
    7: [
      { name: "Caffe Latte (Grande)", calories: 190, category: "Drinks", protein: 12, carbs: 18, fat: 7 },
      { name: "Caramel Macchiato", calories: 250, category: "Drinks", protein: 10, carbs: 34, fat: 7 },
      { name: "Frappuccino", calories: 420, category: "Drinks", protein: 5, carbs: 66, fat: 16 },
      { name: "Americano", calories: 15, category: "Drinks", protein: 1, carbs: 2, fat: 0 },
      { name: "Croissant", calories: 260, category: "Bakery", protein: 5, carbs: 27, fat: 15 },
      { name: "Turkey Sandwich", calories: 330, category: "Food", protein: 20, carbs: 43, fat: 8 },
    ],
    8: [
      { name: "Crunchy Taco", calories: 170, category: "Tacos", protein: 8, carbs: 13, fat: 9 },
      { name: "Soft Taco", calories: 180, category: "Tacos", protein: 9, carbs: 18, fat: 8 },
      { name: "Burrito Supreme", calories: 390, category: "Burritos", protein: 14, carbs: 51, fat: 13 },
      { name: "Quesadilla", calories: 510, category: "Specialties", protein: 20, carbs: 39, fat: 28 },
      { name: "Nachos Supreme", calories: 440, category: "Sides", protein: 13, carbs: 41, fat: 24 },
      { name: "Crunchwrap Supreme", calories: 530, category: "Specialties", protein: 16, carbs: 71, fat: 21 },
    ],
    9: [
      { name: "Dave's Single", calories: 570, category: "Burgers", protein: 29, carbs: 39, fat: 34 },
      { name: "Spicy Chicken Sandwich", calories: 510, category: "Burgers", protein: 28, carbs: 51, fat: 20 },
      { name: "Baconator", calories: 950, category: "Burgers", protein: 57, carbs: 38, fat: 62 },
      { name: "Crispy Chicken BLT", calories: 670, category: "Burgers", protein: 32, carbs: 54, fat: 35 },
      { name: "Chicken Nuggets (10pc)", calories: 450, category: "Sides", protein: 22, carbs: 30, fat: 28 },
      { name: "Chili", calories: 240, category: "Sides", protein: 17, carbs: 23, fat: 7 },
      { name: "Frosty (Medium)", calories: 470, category: "Desserts", protein: 12, carbs: 79, fat: 12 },
    ],
    10: [
      { name: "Chicken Burrito Bowl", calories: 665, category: "Bowls", protein: 42, carbs: 71, fat: 24 },
      { name: "Steak Burrito", calories: 930, category: "Burritos", protein: 41, carbs: 110, fat: 32 },
      { name: "Carnitas Tacos (3)", calories: 630, category: "Tacos", protein: 32, carbs: 60, fat: 27 },
      { name: "Veggie Bowl", calories: 430, category: "Bowls", protein: 14, carbs: 68, fat: 13 },
      { name: "Chicken Burrito", calories: 1025, category: "Burritos", protein: 56, carbs: 123, fat: 35 },
      { name: "Chips & Guacamole", calories: 510, category: "Sides", protein: 6, carbs: 52, fat: 32 },
    ],
  };

  const grabItems = [
    { name: "Banana", calories: 105, description: "Medium, wrapped", protein: 1, carbs: 27, fat: 0 },
    { name: "Apple", calories: 95, description: "Large, red", protein: 0, carbs: 25, fat: 0 },
    { name: "Protein Bar", calories: 200, description: "Chocolate peanut", protein: 20, carbs: 22, fat: 7 },
    { name: "Greek Yogurt", calories: 150, description: "Plain, 170g", protein: 17, carbs: 8, fat: 4 },
    { name: "Trail Mix", calories: 180, description: "Nuts & dried fruit", protein: 5, carbs: 17, fat: 12 },
    { name: "Hard Boiled Eggs (2)", calories: 140, description: "Pre-cooked", protein: 13, carbs: 1, fat: 10 },
    { name: "String Cheese", calories: 80, description: "Mozzarella stick", protein: 7, carbs: 1, fat: 6 },
    { name: "Baby Carrots", calories: 35, description: "With hummus", protein: 2, carbs: 5, fat: 2 },
  ];

  const addItem = async (item, source) => {
    const userId = localStorage.getItem("hungrxUserId");
    const meal = {
      name: item.name,
      calories: Number(item.calories || item.calories_approx || 0),
      protein: Number(item.protein || item.protein_g || 0),
      carbs: Number(item.carbs || item.carbs_g || 0),
      fat: Number(item.fat || item.fat_g || 0),
      source,
    };

    // Always update UI immediately (optimistic update)
    setTotalCalories((c) => c + meal.calories);
    setTotalProtein((p) => p + meal.protein);
    setTotalCarbs((c) => c + meal.carbs);
    setTotalFat((f) => f + meal.fat);
    setMealHistory((h) => [...h, {
      ...meal,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    }]);

    // Then sync to DB in background
    if (!userId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/logs/${userId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...meal, tzOffset: new Date().getTimezoneOffset() }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setTotalCalories(d.totalCalories);
        setTotalProtein(d.totalProtein);
        setTotalCarbs(d.totalCarbs);
        setTotalFat(d.totalFat);
        setMealHistory((d.meals || []).map((m) => ({
          _id: m._id,
          name: m.name,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          source: m.source,
          timestamp: new Date(m.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        })));
      }
    } catch (e) {
      console.error("Failed to sync meal to DB:", e.message);
    }
  };

  const removeItem = async (index) => {
    const userId = localStorage.getItem("hungrxUserId");
    const item = mealHistory[index];
    if (!item._id) {
      // local only fallback
      setTotalCalories((c) => c - item.calories);
      setTotalProtein((p) => p - item.protein);
      setTotalCarbs((c) => c - item.carbs);
      setTotalFat((f) => f - item.fat);
      setMealHistory((h) => h.filter((_, i) => i !== index));
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/logs/${userId}/remove/${item._id}?tz=${new Date().getTimezoneOffset()}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setTotalCalories(d.totalCalories);
        setTotalProtein(d.totalProtein);
        setTotalCarbs(d.totalCarbs);
        setTotalFat(d.totalFat);
        setMealHistory((d.meals || []).map((m) => ({
          _id: m._id,
          name: m.name,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          source: m.source,
          timestamp: new Date(m.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        })));
      }
    } catch (e) {
      setMealHistory((h) => h.filter((_, i) => i !== index));
    }
  };

  const caloriePercentage = Math.min((totalCalories / tdeeCalories) * 100, 100);
  const isOver = totalCalories > tdeeCalories;
  const remaining = tdeeCalories - totalCalories;

  const groupByCategory = (items) =>
    items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

  // ── AI log() ─────────────────────────────────────────────────
  const log = useLogFeature(addItem, setCurrentView);

  // ── Profile edit state ────────────────────────────────────────
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const loadProfile = async () => {
    const userId = localStorage.getItem("hungrxUserId");
    if (!userId) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}`);
      const json = await res.json();
      if (json.success) setProfileData(json.data);
    } catch (e) { console.error("Profile load failed:", e.message); }
    finally { setProfileLoading(false); }
  };

  const saveProfile = async () => {
    const userId = localStorage.getItem("hungrxUserId");
    if (!userId || !profileData) return;
    setProfileSaving(true);
    setProfileError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setProfileData(json.data);
      setProfileSaved(true);
      setTimeout(() => { setProfileSaved(false); setCurrentView("main"); }, 1200);
    } catch (e) {
      setProfileError(e.message || "Save failed. Try again.");
    } finally { setProfileSaving(false); }
  };


  const s = {
    outer: { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a1a", fontFamily: "'JetBrains Mono', monospace", WebkitFontSmoothing: "antialiased" },
    frame: { width: "375px", maxWidth: "100%", height: "min(812px, calc(100dvh - 40px))", background: "#000", borderRadius: "54px", padding: "14px", boxShadow: "0 50px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(186,218,85,0.2) inset", position: "relative", flexShrink: 0 },
    inner: { width: "100%", height: "100%", background: "#1e1e1e", borderRadius: "40px", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" },
    statusBar: { height: "44px", padding: "0 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "8px", flexShrink: 0 },
    time: { fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", color: "#bada55" },
    notch: { position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "150px", height: "30px", background: "#000", borderRadius: "0 0 20px 20px" },
    content: { flex: 1, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: "90px" },
    dashHeader: { padding: "24px", borderBottom: "1px solid #3e3e42", background: "#252526" },
    headerLabel: { fontSize: "11px", letterSpacing: "0.1em", fontWeight: 500, marginBottom: "8px" },
    comment: { color: "#858585" },
    keyword: { color: "#569cd6" },
    calDisplay: { fontSize: "48px", fontWeight: 300, color: "#bada55", letterSpacing: "-0.03em" },
    calLimit: { fontSize: "24px", color: "#858585" },
    progressBar: { marginTop: "12px", height: "4px", background: "#3e3e42", borderRadius: "2px", overflow: "hidden" },
    progressFill: (pct, over) => ({ height: "100%", width: pct + "%", background: over ? "#f48771" : "#bada55", transition: "width 0.3s ease" }),
    progressInfo: { marginTop: "6px", fontSize: "11px", color: "#858585" },
    collapsibleBtn: { width: "100%", padding: "16px 24px", background: "#252526", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid #3e3e42" },
    sectionHeader: { fontSize: "11px", letterSpacing: "0.1em", fontWeight: 500, marginBottom: 0 },
    arrow: (open) => ({ fontSize: "16px", color: "#569cd6", transition: "transform 0.3s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)" }),
    collapsibleContent: { padding: "16px 24px", display: "grid", gap: "16px" },
    macroRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" },
    macroDot: (color) => ({ width: "10px", height: "10px", background: color, borderRadius: "2px" }),
    macroLabel: { fontSize: "11px", color: "#d4d4d4", letterSpacing: "0.03em" },
    macroVal: { fontSize: "10px", color: "#858585", marginBottom: "8px", paddingLeft: "20px" },
    microBar: { height: "3px", background: "#3e3e42", borderRadius: "2px", overflow: "hidden" },
    microFill: (pct, color) => ({ width: Math.min(pct, 100) + "%", height: "100%", background: color, transition: "width 0.3s ease" }),
    eatBtnWrap: { position: "absolute", bottom: "20px", left: 0, right: 0, padding: "0 38px", background: "linear-gradient(to top, #1e1e1e 70%, transparent)", zIndex: 100 },
    eatBtn: { width: "100%", padding: "14px 12px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", letterSpacing: "0.05em", color: "#bada55", fontWeight: 400, fontFamily: "'JetBrains Mono', monospace", flexDirection: "column", gap: "4px" },
    optionsMenu: { padding: "24px", display: "flex", flexDirection: "column", gap: "12px" },
    optionBtn: { width: "100%", padding: "20px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "8px", color: "#bada55", fontSize: "16px", fontWeight: 400, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", textAlign: "left", display: "flex", flexDirection: "column", gap: "6px" },
    optionLabel: { fontSize: "9px", color: "#858585" },
    backBtn: { padding: "12px", background: "transparent", border: "1px solid #858585", borderRadius: "4px", color: "#858585", fontSize: "12px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" },
    listWrap: { padding: "24px", display: "flex", flexDirection: "column", gap: "12px" },
    restaurantBtn: { width: "100%", padding: "14px 16px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", color: "#bada55", fontSize: "14px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: "14px", textAlign: "left" },
    restIcon: { width: "36px", height: "36px", background: "#bada55", color: "#000", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 600, flexShrink: 0 },
    menuContainer: { padding: "24px", display: "flex", flexDirection: "column", gap: "4px" },
    menuHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", letterSpacing: "0.1em", marginBottom: "16px" },
    categoryBtn: { width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #3e3e42", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "6px", marginBottom: "10px" },
    categoryTitle: { fontSize: "10px", letterSpacing: "0.1em", fontWeight: 500 },
    categoryArrow: (open) => ({ fontSize: "14px", color: "#569cd6", transition: "transform 0.3s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)" }),
    menuItem: { padding: "12px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", color: "#bada55", fontSize: "13px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px", textAlign: "left", width: "100%" },
    itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    itemCal: { fontSize: "12px", color: "#ce9178" },
    itemMacros: { display: "flex", gap: "12px", fontSize: "9px", color: "#858585", letterSpacing: "0.05em" },
    recipeCard: { padding: "16px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "8px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "'JetBrains Mono', monospace" },
    recipeTitle: { fontSize: "14px", color: "#bada55", marginBottom: "8px" },
    recipeMeta: { display: "flex", gap: "16px", fontSize: "10px", color: "#858585", flexWrap: "wrap" },
    grabItem: { padding: "16px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", fontFamily: "'JetBrains Mono', monospace" },
    grabName: { fontSize: "14px", color: "#bada55" },
    grabDesc: { fontSize: "10px", color: "#858585" },
    grabCal: { fontSize: "12px", color: "#ce9178", fontWeight: 500 },
    historyItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "4px" },
    removeBtn: { padding: "6px 10px", background: "transparent", border: "1px solid #f48771", borderRadius: "2px", color: "#f48771", fontSize: "10px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" },
    homeBar: { position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", width: "134px", height: "5px", background: "#bada55", borderRadius: "3px", pointerEvents: "none" },
    ingrBox: { background: "#252526", padding: "16px", borderRadius: "8px", border: "1px solid #3e3e42", marginBottom: "16px" },
    ingrItem: { padding: "8px 0", fontSize: "12px", color: "#d4d4d4", borderBottom: "1px solid #3e3e42" },
    stepItem: { padding: "12px 0", fontSize: "12px", color: "#d4d4d4", lineHeight: 1.6, borderBottom: "1px solid #3e3e42" },
    addLogBtn: { padding: "16px", background: "#bada55", color: "#000", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", width: "100%" },
  };

  // ── Sub-component: restaurant menu ────────────────────────────
  const MenuView = () => {
    if (!currentRestaurant) return null;
    const data = menuCache[currentRestaurant.id];
    const recommendation = data?.concierge_recommendation;
    const fullMenu = data?.menu; // normalized from full_menu.categories

    return (
      <div style={s.menuContainer}>
        <div style={s.menuHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ color: "#569cd6", fontSize: "11px" }}>{currentRestaurant.name.toUpperCase()}</span>
            {currentRestaurant.rating && (
              <span style={{ fontSize: "9px", color: "#858585" }}>★ {currentRestaurant.rating} · {currentRestaurant.vicinity}</span>
            )}
          </div>
          <button onClick={() => setCurrentView("restaurants")} style={{ ...s.backBtn, border: "none", padding: "6px 12px" }}>‹ BACK</button>
        </div>

        {/* Loading */}
        {menuLoading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em" }}>// ordering</span>
              <div style={{ display: "flex", gap: "4px" }}>{[0,1,2].map((i) => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#bada55", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
            </div>
          </div>
        )}

        {!menuLoading && data && (<>

          {/* ── CONCIERGE RECOMMENDATION ── */}
          {recommendation && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.1em", marginBottom: "8px" }}>
                <span style={s.comment}>// </span><span style={s.keyword}>CONCIERGE_ORDER</span>
                {recommendation.summary && (
                  <span style={{ color: "#858585" }}>
                    {" · "}{recommendation.summary.total_calories} cal
                    {recommendation.summary.total_cost ? ` · ${userCurrency}${recommendation.summary.total_cost}` : ""}
                  </span>
                )}
              </div>

              {/* Concierge note */}
              {recommendation.note && (
                <div style={{ padding: "10px 12px", background: "#1e3a1e", border: "1px solid #3a5a3a", borderRadius: "6px", marginBottom: "10px" }}>
                  <div style={{ fontSize: "9px", color: "#6ec46e", marginBottom: "3px", letterSpacing: "0.1em" }}>// CONCIERGE_NOTE</div>
                  <div style={{ fontSize: "11px", color: "#d4d4d4", fontStyle: "italic" }}>{recommendation.note}</div>
                </div>
              )}

              {/* Recommended items */}
              {(recommendation.items || []).map((item, i) => (
                <div key={i} style={{ padding: "12px", background: "#1a2a3a", border: "1px solid #2a4a6a", borderRadius: "6px", marginBottom: "8px" }}>
                  <div style={s.itemHeader}>
                    <span style={{ fontSize: "12px", color: "#bada55" }}>{item.item}</span>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {item.price && <span style={{ fontSize: "10px", color: "#858585" }}>{userCurrency}{item.price}</span>}
                      <span style={s.itemCal}>{item.calories} cal</span>
                    </div>
                  </div>
                  <div style={{ fontSize: "9px", color: "#569cd6", margin: "4px 0", fontStyle: "italic", lineHeight: 1.4 }}>{item.why_ordered}</div>
                  <div style={{ ...s.itemMacros }}>
                    <span>P: {item.macros?.protein_g}g</span>
                    <span>C: {item.macros?.carbs_g}g</span>
                    <span>F: {item.macros?.fat_g}g</span>
                    <span style={{ color: "#3e3e42" }}>{item.macro_source}</span>
                  </div>
                </div>
              ))}

              {/* Add concierge order to log */}
              {recommendation.items?.length > 0 && (
                <button style={{ ...s.addLogBtn, marginBottom: "8px" }} onClick={() => {
                  (recommendation.items || []).forEach((item) => {
                    addItem({
                      name: item.item,
                      calories: item.calories,
                      protein: item.macros?.protein_g || 0,
                      carbs: item.macros?.carbs_g || 0,
                      fat: item.macros?.fat_g || 0,
                    }, currentRestaurant.name + " · Concierge");
                  });
                  setCurrentView("main");
                }}>
                  Add Concierge Order to Log
                </button>
              )}
            </div>
          )}

          {/* ── FULL MENU ── */}
          <div style={{ fontSize: "10px", letterSpacing: "0.1em", marginBottom: "10px", paddingTop: "4px", borderTop: "1px solid #2a2a2a" }}>
            <span style={s.comment}>// </span><span style={s.keyword}>FULL_MENU</span>
            <span style={{ color: "#3e3e42", fontSize: "9px" }}> — tap any item to add</span>
          </div>
          {(fullMenu?.categories || []).map((category) => (
            <div key={category.name} style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em", marginBottom: "8px", paddingBottom: "4px", borderBottom: "1px solid #3e3e42" }}>
                <span style={s.comment}>// </span><span style={{ color: "#569cd6" }}>{(category.name || "").toUpperCase()}</span>
              </div>
              {(category.items || []).map((item) => (
                <button key={item.name} style={s.menuItem} onClick={() => addItem(item, currentRestaurant.name)}>
                  <div style={s.itemHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px" }}>{item.name}</span>
                      {item.tier1_safe && (
                        <span style={{ fontSize: "7px", color: "#6ec46e", border: "1px solid #6ec46e", borderRadius: "2px", padding: "1px 4px", letterSpacing: "0.05em" }}>✓ goal</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {item.price && <span style={{ fontSize: "10px", color: "#858585" }}>{userCurrency}{item.price}</span>}
                      <span style={s.itemCal}>{item.calories} cal</span>
                    </div>
                  </div>
                  {item.description && <div style={{ fontSize: "9px", color: "#858585" }}>{item.description}</div>}
                  <div style={s.itemMacros}>
                    <span>P: {item.protein}g</span><span>C: {item.carbs}g</span><span>F: {item.fat}g</span>
                    {item.macro_source && <span style={{ color: "#3e3e42" }}>{item.macro_source}</span>}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </>)}

        {!menuLoading && !data && (
          <div style={{ textAlign: "center", padding: "30px", color: "#858585", fontSize: "11px" }}>// menu unavailable</div>
        )}
      </div>
    );
  };

  // ── Sub-component: Gemini cook() list view ────────────────────
  const CookListView = () => (
    <div style={s.listWrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <div style={s.sectionHeader}><span style={s.comment}>// </span><span style={s.keyword}>AI_RECIPES</span></div>
        <button style={{ ...s.backBtn, border: "none", padding: "6px 12px" }} onClick={() => setCurrentView("options")}>‹ BACK</button>
      </div>

      {/* loading */}
      {geminiLoading && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <span style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em" }}>// curating</span>
            <div style={{ display: "flex", gap: "4px" }}>{[0,1,2].map((i) => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#bada55", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
          </div>
        </div>
      )}

      {/* error */}
      {geminiError && !geminiLoading && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: "11px", color: "#f48771", marginBottom: "12px" }}>{geminiError}</div>
          <button style={{ ...s.backBtn, color: "#bada55", borderColor: "#bada55" }} onClick={fetchGeminiRecipes}>retry()</button>
        </div>
      )}

      {/* empty state — first load */}
      {!geminiLoading && !geminiError && geminiRecipes.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <div style={{ fontSize: "11px", color: "#858585", marginBottom: "16px" }}>// real recipes · locally available · powered by gemini</div>
          <button className="hx-btn" style={{ ...s.optionBtn, alignItems: "center" }} onClick={fetchGeminiRecipes}>
            <span style={s.optionLabel}>// tap to generate</span>
            <span>generate()</span>
          </button>
        </div>
      )}

      {/* availability region banner */}
      {!geminiLoading && geminiRecipes.length > 0 && geminiAvailabilityRegion && (
        <div style={{ padding: "10px 12px", background: "#1e2a1e", border: "1px solid #3a5a3a", borderRadius: "6px", marginBottom: "4px" }}>
          <div style={{ fontSize: "9px", color: "#6ec46e", letterSpacing: "0.1em", marginBottom: "2px" }}>// LOCATION_FILTER_APPLIED</div>
          <div style={{ fontSize: "10px", color: "#d4d4d4" }}>{geminiAvailabilityRegion}</div>
        </div>
      )}

      {/* recipe list */}
      {!geminiLoading && geminiRecipes.map((r) => (
        <button
          key={r.rank}
          className="hx-btn"
          style={s.recipeCard}
          onClick={() => fetchGeminiDetail(r)}
        >
          <div style={s.recipeTitle}>{r.name}</div>
          <div style={{ ...s.recipeMeta, marginBottom: "6px" }}>
            <span>{r.calories_approx} cal</span>
            <span>P: {r.protein_g}g</span>
            <span>C: {r.carbs_g}g</span>
            <span>F: {r.fat_g}g</span>
            <span>{r.cook_time_mins} min</span>
          </div>
          <div style={{ fontSize: "9px", color: "#569cd6", marginBottom: "4px" }}>{r.cuisine} · {r.skill_level}</div>
          {r.why_picked && (
            <div style={{ fontSize: "8px", color: "#858585", fontStyle: "italic", lineHeight: 1.4 }}>{r.why_picked}</div>
          )}
        </button>
      ))}

      {/* refresh */}
      {!geminiLoading && geminiRecipes.length > 0 && (
        <button style={{ ...s.backBtn, color: "#569cd6", borderColor: "#569cd6" }} onClick={fetchGeminiRecipes}>
          refresh recipes ↺
        </button>
      )}
    </div>
  );

  // ── Sub-component: Gemini recipe detail view ──────────────────
  const CookDetailView = () => {
    if (!geminiDetail) return null;
    const r = geminiDetail;
    return (
      <div style={{ padding: "24px" }}>
        <div style={s.menuHeader}>
          <span style={{ color: "#569cd6", fontSize: "11px" }}>{r.name?.toUpperCase()}</span>
          <button onClick={() => setCurrentView("cook")} style={{ ...s.backBtn, border: "none", padding: "6px 12px" }}>‹ BACK</button>
        </div>

        {/* macros row */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          {[
            { label: "cal", val: r.calories },
            { label: "P", val: `${r.protein_g}g` },
            { label: "C", val: `${r.carbs_g}g` },
            { label: "F", val: `${r.fat_g}g` },
            { label: "min", val: r.cook_time_mins },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", padding: "6px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#bada55" }}>{val}</div>
              <div style={{ fontSize: "9px", color: "#858585" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* cook note */}
        {r.cook_note && (
          <div style={{ fontSize: "10px", color: "#858585", fontStyle: "italic", marginBottom: "16px", padding: "10px", background: "#252526", borderRadius: "4px", border: "1px solid #3e3e42" }}>
            <span style={{ color: "#569cd6" }}>// </span>{r.cook_note}
          </div>
        )}

        {/* ingredients */}
        <div style={{ fontSize: "11px", ...s.sectionHeader, marginBottom: "12px" }}>
          <span style={s.comment}>// </span><span style={s.keyword}>INGREDIENTS</span>
        </div>
        <div style={s.ingrBox}>
          {(r.ingredients || []).map((ing, i) => (
            <div key={i} style={{ ...s.ingrItem, borderBottom: i < r.ingredients.length - 1 ? "1px solid #3e3e42" : "none" }}>{ing}</div>
          ))}
        </div>

        {/* instructions */}
        <div style={{ fontSize: "11px", ...s.sectionHeader, marginBottom: "12px" }}>
          <span style={s.comment}>// </span><span style={s.keyword}>INSTRUCTIONS</span>
        </div>
        <div style={{ ...s.ingrBox, marginBottom: "20px" }}>
          {(r.instructions || []).map((step, i) => (
            <div key={i} style={{ ...s.stepItem, borderBottom: i < r.instructions.length - 1 ? "1px solid #3e3e42" : "none" }}>
              <span style={{ color: "#569cd6", fontWeight: 600, marginRight: "8px" }}>{i + 1}.</span>{step}
            </div>
          ))}
        </div>

        {/* source */}
        {r.source && (
          <div style={{ fontSize: "9px", color: "#858585", marginBottom: "16px" }}>source: {r.source}</div>
        )}

        {/* add to log */}
        <button
          style={s.addLogBtn}
          onClick={() => {
            addItem({
              name: r.name,
              calories: r.calories,
              protein: r.protein_g,
              carbs: r.carbs_g,
              fat: r.fat_g,
            }, "Home Cook · Gemini");
            setCurrentView("main");
          }}
        >
          Add to Log
        </button>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; background: #1a1a1a; }
        .hx-content::-webkit-scrollbar { display: none; }
        .hx-btn:hover { background: rgba(186,218,85,0.07) !important; border-color: #bada55 !important; }
        .hx-btn:active { transform: scale(0.98); }
        .hx-remove:hover { background: rgba(244,135,113,0.1) !important; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @media (max-width: 550px) {
          .hx-outer { padding: 0 !important; align-items: stretch !important; }
          .hx-frame { width: 100% !important; max-width: 100% !important; height: 100dvh !important; border-radius: 0 !important; padding: 0 !important; background: #1e1e1e !important; box-shadow: none !important; }
          .hx-inner { border-radius: 0 !important; }
          .hx-statusbar { display: none !important; }
          .hx-homebar { display: none !important; }
        }
      `}</style>
      <div style={{ ...s.outer, padding: "20px" }} className="hx-outer">
        <div style={s.frame} className="hx-frame">
          <div style={s.inner} className="hx-inner">

            {/* Status Bar */}
            <div className="hx-statusbar" style={{ ...s.statusBar, position: "relative" }}>
              <span style={s.time}>{currentTime}</span>
              <div style={s.notch} />
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ display: "flex", gap: "1px", alignItems: "flex-end" }}>
                  {[8, 11, 14, 17].map((h, i) => (
                    <div key={i} style={{ width: "3px", height: `${h}px`, background: "#bada55", borderRadius: "1px" }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  <div style={{ width: "24px", height: "12px", border: "1px solid #bada55", borderRadius: "3px", padding: "2px" }}>
                    <div style={{ width: "100%", height: "100%", background: "#bada55", borderRadius: "1px" }} />
                  </div>
                  <div style={{ width: "2px", height: "5px", background: "#bada55", borderRadius: "0 1px 1px 0" }} />
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={s.content} className="hx-content">

              {/* Dashboard Header */}
              <div style={s.dashHeader}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={s.headerLabel}>
                    <span style={s.comment}>// </span>
                    <span style={s.keyword}>DAILY_LIMIT</span>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button onClick={() => setCurrentView("profile")} style={{ background: "transparent", border: "none", color: "#858585", fontSize: "10px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                      profile()
                    </button>
                    {onLogout && (
                      <button onClick={onLogout} style={{ background: "transparent", border: "none", color: "#858585", fontSize: "10px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                        logout()
                      </button>
                    )}
                  </div>
                </div>
                <div style={s.calDisplay}>
                  {logLoading
                    ? <span style={{ color: "#3e3e42", fontSize: "36px" }}>...</span>
                    : <>{totalCalories}<span style={s.calLimit}> / {tdeeCalories}</span></>
                  }
                </div>
                <div style={s.progressBar}>
                  <div style={logLoading ? {} : s.progressFill(caloriePercentage, isOver)} />
                </div>
                <div style={s.progressInfo}>
                  {logLoading
                    ? <span style={{ color: "#3e3e42" }}>// loading...</span>
                    : isOver
                      ? <span style={{ color: "#f48771" }}>// OVER_LIMIT: +{Math.abs(remaining)} cal</span>
                      : <><span style={s.comment}>// REMAINING: </span><span>{remaining}</span><span style={s.comment}> cal</span></>
                  }
                </div>
              </div>

              {/* Macros */}
              <div style={{ borderBottom: "1px solid #3e3e42" }}>
                <button style={s.collapsibleBtn} onClick={() => setMacrosOpen(!macrosOpen)}>
                  <div style={s.sectionHeader}><span style={s.comment}>// </span><span style={s.keyword}>MACROS</span></div>
                  <span style={s.arrow(macrosOpen)}>›</span>
                </button>
                {macrosOpen && (
                  <div style={s.collapsibleContent}>
                    {[
                      { label: "Protein", val: totalProtein, target: proteinTarget, color: "#6ec46e", unit: "g" },
                      { label: "Carbs",   val: totalCarbs,   target: carbsTarget,   color: "#5fa3e0", unit: "g" },
                      { label: "Fat",     val: totalFat,     target: fatTarget,     color: "#e0b75f", unit: "g" },
                    ].map(({ label, val, target, color, unit }) => (
                      <div key={label}>
                        <div style={s.macroRow}><div style={s.macroDot(color)} /><span style={s.macroLabel}>{label}</span></div>
                        <div style={s.macroVal}>{val}{unit} / {target}{unit}</div>
                        <div style={s.microBar}><div style={s.microFill((val / target) * 100, color)} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Meal History */}
              <div style={{ borderBottom: "1px solid #3e3e42" }}>
                <button style={s.collapsibleBtn} onClick={() => setHistoryOpen(!historyOpen)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={s.sectionHeader}><span style={s.comment}>// </span><span style={s.keyword}>MEAL_HISTORY</span></div>
                    <span style={{ fontSize: "11px", color: logLoading ? "#3e3e42" : "#bada55" }}>{logLoading ? "(…)" : `(${mealHistory.length})`}</span>
                  </div>
                  <span style={s.arrow(historyOpen)}>›</span>
                </button>
                {historyOpen && (
                  <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {mealHistory.length === 0
                      ? <div style={{ textAlign: "center", padding: "20px", color: "#858585", fontSize: "12px", fontStyle: "italic" }}>// no_meals_logged</div>
                      : mealHistory.map((item, i) => (
                        <div key={i} style={s.historyItem}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                            <span style={{ fontSize: "13px", color: "#bada55" }}>{item.name}</span>
                            <span style={{ fontSize: "10px", color: "#858585" }}>{item.source} • {item.timestamp}</span>
                            <div style={{ display: "flex", gap: "12px", fontSize: "9px", color: "#858585" }}>
                              <span>P: {item.protein}g</span><span>C: {item.carbs}g</span><span>F: {item.fat}g</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={s.itemCal}>{item.calories}</span>
                            <button className="hx-remove" style={s.removeBtn} onClick={() => removeItem(i)}>REMOVE</button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* ── VIEWS ── */}

              {currentView === "options" && (
                <div style={s.optionsMenu}>
                  <div style={s.sectionHeader}><span style={s.comment}>// </span><span style={s.keyword}>SELECT_OPTION</span></div>
                  <button className="hx-btn" style={s.optionBtn} onClick={() => setCurrentView("restaurants")}>
                    <span style={s.optionLabel}>// restaurants</span>
                    <span>out()</span>
                  </button>
                  <button className="hx-btn" style={{ ...s.optionBtn, borderColor: "#bada5560" }} onClick={() => setCurrentView("cook")}>
                    <span style={s.optionLabel}>// ai recipe generator · gemini</span>
                    <span>cook()</span>
                  </button>
                  <button className="hx-btn" style={s.optionBtn} onClick={() => setCurrentView("grab")}>
                    <span style={s.optionLabel}>// ready-to-eat</span>
                    <span>grab()</span>
                  </button>
                  <button className="hx-btn" style={{ ...s.optionBtn, borderColor: "#3a4a3a" }} onClick={() => { log.resetLog(); setCurrentView("log"); }}>
                    <span style={{ ...s.optionLabel, color: "#6ec46e" }}>// just describe it</span>
                    <span>log()</span>
                  </button>
                  <button style={s.backBtn} onClick={() => setCurrentView("main")}>‹ BACK</button>
                </div>
              )}

              {currentView === "restaurants" && (
                <div style={s.listWrap}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <div style={s.sectionHeader}><span style={s.comment}>// </span><span style={s.keyword}>NEARBY_RESTAURANTS</span></div>
                    <button style={{ ...s.backBtn, border: "none", padding: "6px 12px" }} onClick={() => setCurrentView("options")}>‹ BACK</button>
                  </div>

                  {/* Initial state — ask for location */}
                  {!restaurantsLoading && nearbyRestaurants.length === 0 && !restaurantsError && (
                    <div style={{ textAlign: "center", padding: "30px 0" }}>
                      <div style={{ fontSize: "11px", color: "#858585", marginBottom: "16px" }}>// tap to find restaurants near you</div>
                      <button className="hx-btn" style={{ ...s.optionBtn, alignItems: "center" }} onClick={fetchNearbyRestaurants}>
                        <span style={s.optionLabel}>// uses your location</span>
                        <span>locate()</span>
                      </button>
                    </div>
                  )}

                  {/* Loading */}
                  {restaurantsLoading && (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                        <span style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em" }}>// scanning</span>
                        <div style={{ display: "flex", gap: "4px" }}>{[0,1,2].map((i) => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#bada55", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {restaurantsError && !restaurantsLoading && (
                    <div style={{ textAlign: "center", padding: "20px 0" }}>
                      <div style={{ fontSize: "11px", color: "#f48771", marginBottom: "12px" }}>{restaurantsError}</div>
                      {!locationDenied && (
                        <button style={{ ...s.backBtn, color: "#bada55", borderColor: "#bada55" }} onClick={fetchNearbyRestaurants}>retry()</button>
                      )}
                    </div>
                  )}

                  {/* Rank context banner */}
                  {!restaurantsLoading && rankContext && nearbyRestaurants.length > 0 && (
                    <div style={{ padding: "10px 12px", background: "#1e2a1e", border: "1px solid #3a5a3a", borderRadius: "6px", marginBottom: "4px" }}>
                      <div style={{ fontSize: "9px", color: "#6ec46e", letterSpacing: "0.1em", marginBottom: "3px" }}>// RANKED_FOR_YOU · {rankContext.personalization_score || "personalised"}</div>
                      <div style={{ fontSize: "10px", color: "#d4d4d4" }}>{rankContext.meal_moment} · {rankContext.inferred_mood} mood</div>
                    </div>
                  )}

                  {/* Real restaurants */}
                  {!restaurantsLoading && nearbyRestaurants.map((r) => {
                    const isCached = !!menuCache[r.id];
                    const freshnessColor = r.freshness_tag === "new" ? "#6ec46e" : r.freshness_tag === "returning favourite" ? "#bada55" : "#858585";
                    return (
                      <button className="hx-btn" key={r.id} style={s.restaurantBtn} onClick={() => openRestaurant(r)}>
                        <div style={{ ...s.restIcon, background: r.openNow === false ? "#3e3e42" : "#bada55", color: r.openNow === false ? "#858585" : "#000", position: "relative" }}>
                          {r.icon}
                          {isCached && (
                            <div style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "#6ec46e", borderRadius: "50%", border: "1px solid #1e1e1e" }} />
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
                          <span style={{ fontSize: "13px" }}>{r.name}</span>
                          <span style={{ fontSize: "9px", color: "#858585" }}>{r.vicinity}</span>
                          <div style={{ display: "flex", gap: "8px", fontSize: "9px", flexWrap: "wrap" }}>
                            {r.rating && <span style={{ color: "#bada55" }}>★ {r.rating}</span>}
                            {r.openNow === true && <span style={{ color: "#6ec46e" }}>● open</span>}
                            {r.openNow === false && <span style={{ color: "#f48771" }}>● closed</span>}
                            {r.priceLevel && <span style={{ color: "#858585" }}>{userCurrency.repeat(r.priceLevel)}</span>}
                            {isCached && <span style={{ color: "#6ec46e" }}>· menu ready</span>}
                          </div>
                          {r.freshness_tag && (
                            <div style={{ fontSize: "8px", color: freshnessColor, letterSpacing: "0.05em" }}>// {r.freshness_tag}</div>
                          )}
                          {r.why_picked && (
                            <div style={{ fontSize: "8px", color: "#569cd6", fontStyle: "italic", lineHeight: 1.4 }}>{r.why_picked}</div>
                          )}
                        </div>
                        <div style={{ fontSize: "16px", color: "#3e3e42" }}>›</div>
                      </button>
                    );
                  })}

                  {/* Refresh */}
                  {!restaurantsLoading && nearbyRestaurants.length > 0 && (
                    <button style={{ ...s.backBtn, color: "#569cd6", borderColor: "#569cd6" }} onClick={fetchNearbyRestaurants}>
                      refresh ↺
                    </button>
                  )}
                </div>
              )}

              {currentView === "menu" && <MenuView />}

              {/* cook() — Gemini recipe list */}
              {currentView === "cook" && <CookListView />}

              {/* cook detail — Gemini full recipe */}
              {currentView === "cookDetail" && <CookDetailView />}

              {currentView === "grab" && (
                <div style={s.listWrap}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <div style={s.sectionHeader}><span style={s.comment}>// </span><span style={s.keyword}>READY_TO_EAT</span></div>
                    <button style={{ ...s.backBtn, border: "none", padding: "6px 12px" }} onClick={() => setCurrentView("options")}>‹ BACK</button>
                  </div>

                  {/* Loading */}
                  {grabLoading && (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                        <span style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em" }}>// finding</span>
                        <div style={{ display: "flex", gap: "4px" }}>{[0,1,2].map((i) => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#bada55", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {grabError && !grabLoading && (
                    <div style={{ textAlign: "center", padding: "20px 0" }}>
                      <div style={{ fontSize: "11px", color: "#f48771", marginBottom: "12px" }}>{grabError}</div>
                      <button style={{ ...s.backBtn, color: "#bada55", borderColor: "#bada55" }} onClick={fetchGrabItems}>retry()</button>
                    </div>
                  )}

                  {/* Empty state */}
                  {!grabLoading && !grabError && !grabData && (
                    <div style={{ textAlign: "center", padding: "30px 0" }}>
                      <div style={{ fontSize: "11px", color: "#858585", marginBottom: "16px" }}>// real products · local brands · powered by gemini</div>
                      <button className="hx-btn" style={{ ...s.optionBtn, alignItems: "center" }} onClick={fetchGrabItems}>
                        <span style={s.optionLabel}>// tap to curate</span>
                        <span>grab()</span>
                      </button>
                    </div>
                  )}

                  {/* Location + availability banner */}
                  {!grabLoading && grabData?.availability_region && (
                    <div style={{ padding: "10px 12px", background: "#1e2a1e", border: "1px solid #3a5a3a", borderRadius: "6px", marginBottom: "4px" }}>
                      <div style={{ fontSize: "9px", color: "#6ec46e", letterSpacing: "0.1em", marginBottom: "2px" }}>// LOCATION_FILTER_APPLIED</div>
                      <div style={{ fontSize: "10px", color: "#d4d4d4" }}>{grabData.availability_region}</div>
                      {grabData.user_context?.nearby_stores && (
                        <div style={{ fontSize: "9px", color: "#858585", marginTop: "2px" }}>{grabData.user_context.nearby_stores}</div>
                      )}
                    </div>
                  )}

                  {/* Curator note */}
                  {!grabLoading && grabData?.curator_note && (
                    <div style={{ padding: "10px 12px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "6px", marginBottom: "4px" }}>
                      <div style={{ fontSize: "9px", color: "#569cd6", marginBottom: "2px", letterSpacing: "0.1em" }}>// CURATOR_NOTE</div>
                      <div style={{ fontSize: "11px", color: "#d4d4d4", fontStyle: "italic" }}>{grabData.curator_note}</div>
                    </div>
                  )}

                  {/* Categories + items */}
                  {!grabLoading && grabData && (grabData.grocery_list || []).map((cat) => (
                    <div key={cat.category} style={{ marginBottom: "20px" }}>
                      <div style={{ marginBottom: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#569cd6", letterSpacing: "0.1em" }}>
                          <span style={s.comment}>// </span>{cat.category.toUpperCase()}
                        </div>
                        {cat.category_note && <div style={{ fontSize: "9px", color: "#858585", marginTop: "2px" }}>{cat.category_note}</div>}
                      </div>
                      {(cat.items || []).map((item) => (
                        <button key={item.rank} className="hx-btn" style={s.grabItem}
                          onClick={() => addItem({
                            name: `${item.brand} ${item.product} ${item.variant || ""}`.trim(),
                            calories: item.calories,
                            protein: item.macros?.protein_g || 0,
                            carbs: item.macros?.carbs_g || 0,
                            fat: item.macros?.fat_g || 0,
                          }, "Quick Grab · Gemini")}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                            <span style={s.grabName}>{item.brand} {item.product}</span>
                            <span style={s.grabDesc}>{item.variant}</span>
                            <div style={{ display: "flex", gap: "10px", fontSize: "9px", color: "#858585" }}>
                              <span>P: {item.macros?.protein_g}g</span>
                              <span>C: {item.macros?.carbs_g}g</span>
                              <span>F: {item.macros?.fat_g}g</span>
                              {item.price_approx && <span style={{ color: "#6ec46e" }}>{grabCurrency}{item.price_approx}</span>}
                            </div>
                            {item.why_picked && (
                              <div style={{ fontSize: "8px", color: "#569cd6", fontStyle: "italic", lineHeight: 1.4 }}>{item.why_picked}</div>
                            )}
                          </div>
                          <span style={s.grabCal}>{item.calories} cal</span>
                        </button>
                      ))}
                    </div>
                  ))}

                  {/* Session summary */}
                  {!grabLoading && grabData?.session_summary && (
                    <div style={{ padding: "10px 12px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "6px", marginBottom: "8px" }}>
                      <div style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.08em", marginBottom: "4px" }}>// session_summary</div>
                      <div style={{ display: "flex", gap: "16px", fontSize: "9px", color: "#d4d4d4", flexWrap: "wrap" }}>
                        <span>{grabData.session_summary.total_items} items across {grabData.session_summary.total_categories} categories</span>
                        {grabData.session_summary.estimated_total_if_all_bought > 0 && (
                          <span style={{ color: "#6ec46e" }}>est. total {grabCurrency}{grabData.session_summary.estimated_total_if_all_bought}</span>
                        )}
                        {grabData.session_summary.new_category_introduced && (
                          <span style={{ color: "#569cd6" }}>new: {grabData.session_summary.new_category_introduced}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Refresh */}
                  {!grabLoading && grabData && (
                    <button style={{ ...s.backBtn, color: "#569cd6", borderColor: "#569cd6" }} onClick={fetchGrabItems}>
                      refresh ↺
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* eat() — pinned to bottom */}
            {currentView === "main" && (
              <div style={s.eatBtnWrap}>
                <button className="hx-btn" style={s.eatBtn} onClick={() => setCurrentView("options")}>
                  <span style={{ fontSize: "9px", color: "#858585" }}>// function</span>
                  <span>eat()</span>
                </button>
              </div>
            )}

            {/* ── PROFILE VIEW — full overlay ── */}
            {currentView === "profile" && (() => {
              if (!profileData && !profileLoading) loadProfile();
              const field = (key, label, type = "text", opts = null) => (
                <div style={{ marginBottom: "14px" }} key={key}>
                  <div style={{ fontSize: "8px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "5px" }}>{label}</div>
                  {opts
                    ? <select value={profileData?.[key] || ""} onChange={(e) => setProfileData((p) => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", background: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", color: "#d4d4d4", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", padding: "9px 10px", outline: "none" }}>
                        <option value="">Select...</option>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    : <input type={type} value={profileData?.[key] || ""} onChange={(e) => setProfileData((p) => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", background: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", color: "#d4d4d4", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", padding: "9px 10px", outline: "none", boxSizing: "border-box" }} />
                  }
                </div>
              );
              return (
                <div style={{ position: "absolute", inset: 0, background: "#1e1e1e", borderRadius: "inherit", display: "flex", flexDirection: "column", zIndex: 10, overflowY: "auto" }}>
                  {/* Header */}
                  <div style={{ padding: "20px 24px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, borderBottom: "1px solid #2a2a2a" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "#858585", letterSpacing: "0.08em" }}><span style={{ color: "#858585" }}>// </span><span style={{ color: "#569cd6" }}>PROFILE</span></div>
                      <div style={{ fontSize: "11px", color: "#858585", marginTop: "2px" }}>edit your details</div>
                    </div>
                    <button onClick={() => setCurrentView("main")} style={{ background: "none", border: "none", color: "#555", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>×</button>
                  </div>

                  {profileLoading && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "40px 0" }}>
                      <span style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em" }}>// loading</span>
                      <div style={{ display: "flex", gap: "4px" }}>{[0,1,2].map((i) => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#bada55", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
                    </div>
                  )}

                  {!profileLoading && profileData && (
                    <div style={{ padding: "20px 24px 32px", flex: 1 }}>
                      {/* Body */}
                      <div style={{ fontSize: "9px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "14px" }}>// BODY</div>
                      {field("age", "AGE", "number")}
                      {field("gender", "BIOLOGICAL SEX", "select", ["Male", "Female", "Other"])}
                      {field("height", "HEIGHT (cm)", "number")}
                      {field("weight", "WEIGHT (kg)", "number")}

                      {/* Goals */}
                      <div style={{ fontSize: "9px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "14px", marginTop: "6px" }}>// GOALS</div>
                      {field("primaryGoal", "PRIMARY GOAL", "select", ["Lose Weight", "Gain Weight", "Maintain Weight"])}
                      {field("specificTarget", "SPECIFIC TARGET", "text")}
                      {field("secondaryGoals", "SECONDARY GOALS", "text")}
                      {field("activityLevel", "ACTIVITY LEVEL", "select", ["Sedentary", "Lightly Active", "Moderately Active", "Very Active", "Extremely Active"])}

                      {/* Food */}
                      <div style={{ fontSize: "9px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "14px", marginTop: "6px" }}>// FOOD</div>
                      {field("eatingPattern", "EATING PATTERN", "text")}
                      {field("restrictions", "DIETARY RESTRICTIONS", "text")}
                      {field("dislikes", "FOOD DISLIKES", "text")}
                      {field("favorites", "FAVOURITE FOODS", "text")}
                      {field("budget", "DAILY FOOD BUDGET", "text")}

                      {/* Cooking */}
                      <div style={{ fontSize: "9px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "14px", marginTop: "6px" }}>// COOKING</div>
                      {field("cookingSkill", "COOKING SKILL", "select", ["Beginner - Don't enjoy", "Beginner - Enjoy learning", "Intermediate", "Advanced - Love cooking"])}
                      {field("cookingTime", "TIME FOR COOKING", "text")}

                      {/* Health */}
                      <div style={{ fontSize: "9px", color: "#569cd6", letterSpacing: "0.1em", marginBottom: "14px", marginTop: "6px" }}>// HEALTH</div>
                      {field("healthConditions", "HEALTH CONDITIONS", "text")}
                      {field("sleepEnergy", "SLEEP & ENERGY", "text")}
                      {field("obstacles", "PAST OBSTACLES", "text")}

                      {/* TDEE display — read only */}
                      {profileData.tdee && (
                        <div style={{ padding: "12px", background: "#252526", border: "1px solid #3e3e42", borderRadius: "6px", marginBottom: "16px", marginTop: "8px" }}>
                          <div style={{ fontSize: "9px", color: "#858585", marginBottom: "6px" }}>// recalculated on save</div>
                          <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>
                            <span style={{ color: "#858585" }}>TDEE <span style={{ color: "#bada55" }}>{profileData.tdee}</span></span>
                            <span style={{ color: "#858585" }}>TARGET <span style={{ color: "#bada55" }}>{profileData.dailyCalorieTarget}</span></span>
                            <span style={{ color: "#858585" }}>BMI <span style={{ color: "#bada55" }}>{profileData.bmi?.toFixed(1)}</span></span>
                          </div>
                        </div>
                      )}

                      {profileError && <div style={{ fontSize: "10px", color: "#f48771", marginBottom: "12px" }}><span style={{ color: "#858585" }}>// </span>{profileError}</div>}

                      <button onClick={saveProfile} disabled={profileSaving} style={{ width: "100%", padding: "16px", background: "transparent", border: `1px solid ${profileSaved ? "#6ec46e" : "#bada55"}`, borderRadius: "8px", color: profileSaved ? "#6ec46e" : "#bada55", fontSize: "13px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em", opacity: profileSaving ? 0.6 : 1 }}>
                        {profileSaved ? "✓  saved" : profileSaving ? "saving..." : "save()"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── LOG VIEW — full overlay ── */}
            {currentView === "log" && <LogView log={log} setCurrentView={setCurrentView} />}

            <div className="hx-homebar" style={s.homeBar} />
          </div>
        </div>
      </div>
    </>
  );
};

export default HungrXDashboard;