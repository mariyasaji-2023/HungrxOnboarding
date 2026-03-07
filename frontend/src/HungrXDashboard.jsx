import { useState, useEffect } from "react";

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
  const [microsOpen, setMicrosOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [currentTime, setCurrentTime] = useState("");

  // ── Gemini cook() state ───────────────────────────────────────
  const [geminiRecipes, setGeminiRecipes] = useState([]);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState("");
  const [geminiDetail, setGeminiDetail] = useState(null);

  const [userLocation, setUserLocation] = useState(null);

  // ── grab() state ─────────────────────────────────────────────
  const [grabData, setGrabData] = useState(null);
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
        // Save to DB — backend only writes if location changed
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
    try {
      const res = await fetch(`${BACKEND_URL}/api/cook/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed");
      setGeminiRecipes(json.data.recipes || []);
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

          const res = await fetch(`${BACKEND_URL}/api/restaurants/nearby`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude, radius: 1500 }),
          });
          const json = await res.json();
          if (json.success) {
            const list = json.data || [];
            setNearbyRestaurants(list);
            if (list.length === 0) {
              setRestaurantsError("No restaurants found nearby.");
            } else {
              localStorage.setItem("hungrx_restaurants", JSON.stringify({
                list, lat: latitude, lng: longitude, savedAt: now,
              }));
            }
          } else {
            setRestaurantsError(json.message || "Failed to fetch restaurants.");
          }
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

  const s = {
    outer: { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a1a", fontFamily: "'JetBrains Mono', monospace", WebkitFontSmoothing: "antialiased", padding: "20px" },
    frame: { width: "375px", height: "min(812px, calc(100dvh - 40px))", background: "#000", borderRadius: "54px", padding: "14px", boxShadow: "0 50px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(186,218,85,0.2) inset", position: "relative", flexShrink: 0 },
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
    const menu = data?.menu;
    const recommendation = data?.recommended_order;
    const summary = data?.order_summary;
    const note = data?.concierge_note;

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
            <div style={{ fontSize: "11px", color: "#858585", marginBottom: "12px" }}>// your concierge is ordering...</div>
            <div style={{ width: "100%", height: "2px", background: "#3e3e42", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", background: "#bada55", borderRadius: "2px", animation: "pulse 1.2s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {!menuLoading && data && (<>

          {/* Concierge note */}
          {note && (
            <div style={{ padding: "12px", background: "#1e3a1e", border: "1px solid #3a5a3a", borderRadius: "8px", marginBottom: "16px" }}>
              <div style={{ fontSize: "9px", color: "#6ec46e", marginBottom: "4px", letterSpacing: "0.1em" }}>// CONCIERGE_NOTE</div>
              <div style={{ fontSize: "11px", color: "#d4d4d4", fontStyle: "italic" }}>{note}</div>
            </div>
          )}

          {/* Recommended order */}
          {recommendation && recommendation.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.1em", marginBottom: "8px" }}>
                <span style={s.comment}>// </span><span style={s.keyword}>RECOMMENDED_ORDER</span>
                {summary && <span style={{ color: "#858585" }}> · {summary.total_calories} cal · ${summary.total_cost}</span>}
              </div>
              {recommendation.map((item, i) => (
                <div key={i} style={{ padding: "12px", background: "#1a2a3a", border: "1px solid #2a4a6a", borderRadius: "6px", marginBottom: "8px" }}>
                  <div style={s.itemHeader}>
                    <span style={{ fontSize: "12px", color: "#bada55" }}>{item.item}</span>
                    <span style={s.itemCal}>{item.calories} cal</span>
                  </div>
                  <div style={{ fontSize: "9px", color: "#569cd6", margin: "4px 0", fontStyle: "italic" }}>{item.why_ordered}</div>
                  <div style={{ ...s.itemMacros, marginBottom: "8px" }}>
                    <span>P: {item.macros?.protein_g}g</span>
                    <span>C: {item.macros?.carbs_g}g</span>
                    <span>F: {item.macros?.fat_g}g</span>
                    {item.price && <span style={{ color: "#858585" }}>${item.price}</span>}
                  </div>
                </div>
              ))}
              {/* Add full recommended order to log */}
              <button style={{ ...s.addLogBtn, marginBottom: "16px" }} onClick={() => {
                recommendation.forEach((item) => {
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
            </div>
          )}

          {/* Full menu — all categories expanded */}
          <div style={{ fontSize: "10px", letterSpacing: "0.1em", marginBottom: "8px" }}>
            <span style={s.comment}>// </span><span style={s.keyword}>FULL_MENU</span>
          </div>
          {(menu?.categories || []).map((category) => (
            <div key={category.name} style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "9px", color: "#858585", letterSpacing: "0.1em", marginBottom: "8px", paddingBottom: "4px", borderBottom: "1px solid #3e3e42" }}>
                <span style={s.comment}>// </span><span style={{ color: "#569cd6" }}>{category.name.toUpperCase()}</span>
              </div>
              {(category.items || []).map((item) => (
                <button key={item.name} style={s.menuItem} onClick={() => addItem(item, currentRestaurant.name)}>
                  <div style={s.itemHeader}>
                    <span style={{ fontSize: "12px" }}>{item.name}</span>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {item.price && <span style={{ fontSize: "10px", color: "#858585" }}>${item.price}</span>}
                      <span style={s.itemCal}>{item.calories} cal</span>
                    </div>
                  </div>
                  {item.description && <div style={{ fontSize: "9px", color: "#858585" }}>{item.description}</div>}
                  <div style={s.itemMacros}><span>P: {item.protein}g</span><span>C: {item.carbs}g</span><span>F: {item.fat}g</span></div>
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
          <div style={{ fontSize: "11px", color: "#858585", marginBottom: "12px" }}>// generating recipes...</div>
          <div style={{ width: "100%", height: "2px", background: "#3e3e42", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "60%", background: "#bada55", borderRadius: "2px", animation: "pulse 1.2s ease-in-out infinite" }} />
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
          <div style={{ fontSize: "11px", color: "#858585", marginBottom: "16px" }}>// personalised for you · powered by gemini</div>
          <button className="hx-btn" style={{ ...s.optionBtn, alignItems: "center" }} onClick={fetchGeminiRecipes}>
            <span style={s.optionLabel}>// tap to generate</span>
            <span>generate()</span>
          </button>
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
          <div style={{ fontSize: "9px", color: "#569cd6" }}>{r.cuisine} · {r.skill_level}</div>
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
        @media (max-width: 440px) {
          .hx-frame { max-width: 100% !important; height: 100dvh !important; border-radius: 0 !important; padding: 0 !important; }
          .hx-inner { border-radius: 0 !important; }
        }
      `}</style>
      <div style={s.outer}>
        <div style={s.frame} className="hx-frame">
          <div style={s.inner} className="hx-inner">

            {/* Status Bar */}
            <div style={{ ...s.statusBar, position: "relative" }}>
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
                  {onLogout && (
                    <button onClick={onLogout} style={{ background: "transparent", border: "none", color: "#858585", fontSize: "10px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                      logout()
                    </button>
                  )}
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

              {/* Micros */}
              <div style={{ borderBottom: "1px solid #3e3e42" }}>
                <button style={s.collapsibleBtn} onClick={() => setMicrosOpen(!microsOpen)}>
                  <div style={s.sectionHeader}><span style={s.comment}>// </span><span style={s.keyword}>MICROS</span></div>
                  <span style={s.arrow(microsOpen)}>›</span>
                </button>
                {microsOpen && (
                  <div style={s.collapsibleContent}>
                    {[
                      { label: "Sodium",      val: 0, target: 2300, color: "#ce9178", unit: "mg" },
                      { label: "Fiber",       val: 0, target: 30,   color: "#9cdcfe", unit: "g"  },
                      { label: "Sugar",       val: 0, target: 50,   color: "#c586c0", unit: "g"  },
                      { label: "Cholesterol", val: 0, target: 300,  color: "#dcdcaa", unit: "mg" },
                    ].map(({ label, val, target, color, unit }) => (
                      <div key={label}>
                        <div style={s.macroRow}><div style={s.macroDot(color)} /><span style={s.macroLabel}>{label}</span></div>
                        <div style={s.macroVal}>{val}{unit} / {target}{unit}</div>
                        <div style={s.microBar}><div style={s.microFill(0, color)} /></div>
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
                      <div style={{ fontSize: "11px", color: "#858585", marginBottom: "12px" }}>// scanning nearby...</div>
                      <div style={{ width: "100%", height: "2px", background: "#3e3e42", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "60%", background: "#bada55", borderRadius: "2px", animation: "pulse 1.2s ease-in-out infinite" }} />
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

                  {/* Real restaurants */}
                  {!restaurantsLoading && nearbyRestaurants.map((r) => {
                    const isCached = !!menuCache[r.id];
                    return (
                      <button className="hx-btn" key={r.id} style={s.restaurantBtn} onClick={() => openRestaurant(r)}>
                        <div style={{ ...s.restIcon, background: r.openNow === false ? "#3e3e42" : "#bada55", color: r.openNow === false ? "#858585" : "#000", position: "relative" }}>
                          {r.icon}
                          {isCached && (
                            <div style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "#6ec46e", borderRadius: "50%", border: "1px solid #1e1e1e" }} />
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                          <span style={{ fontSize: "13px" }}>{r.name}</span>
                          <span style={{ fontSize: "9px", color: "#858585" }}>{r.vicinity}</span>
                          <div style={{ display: "flex", gap: "8px", fontSize: "9px" }}>
                            {r.rating && <span style={{ color: "#bada55" }}>★ {r.rating}</span>}
                            {r.openNow === true && <span style={{ color: "#6ec46e" }}>● open</span>}
                            {r.openNow === false && <span style={{ color: "#f48771" }}>● closed</span>}
                            {r.priceLevel && <span style={{ color: "#858585" }}>{"$".repeat(r.priceLevel)}</span>}
                            {isCached && <span style={{ color: "#6ec46e" }}>· menu ready</span>}
                          </div>
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
                      <div style={{ fontSize: "11px", color: "#858585", marginBottom: "12px" }}>// curating your grocery list...</div>
                      <div style={{ width: "100%", height: "2px", background: "#3e3e42", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "60%", background: "#bada55", borderRadius: "2px", animation: "pulse 1.2s ease-in-out infinite" }} />
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
                      <div style={{ fontSize: "11px", color: "#858585", marginBottom: "16px" }}>// real products · personalised · powered by gemini</div>
                      <button className="hx-btn" style={{ ...s.optionBtn, alignItems: "center" }} onClick={fetchGrabItems}>
                        <span style={s.optionLabel}>// tap to curate</span>
                        <span>grab()</span>
                      </button>
                    </div>
                  )}

                  {/* Curator note */}
                  {!grabLoading && grabData?.curator_note && (
                    <div style={{ padding: "12px", background: "#1e3a1e", border: "1px solid #3a5a3a", borderRadius: "8px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "9px", color: "#6ec46e", marginBottom: "4px", letterSpacing: "0.1em" }}>// CURATOR_NOTE</div>
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
                              {item.price_approx && <span style={{ color: "#6ec46e" }}>${item.price_approx}</span>}
                            </div>
                          </div>
                          <span style={s.grabCal}>{item.calories} cal</span>
                        </button>
                      ))}
                    </div>
                  ))}

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

            <div style={s.homeBar} />
          </div>
        </div>
      </div>
    </>
  );
};

export default HungrXDashboard;