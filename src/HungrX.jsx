import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────
const HungrXOnboarding = ({ onComplete }) => {
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState({
    name: "", age: "", gender: "", height: "", weight: "",
    primaryGoal: "", specificTarget: "", secondaryGoals: "",
    activityLevel: "", eatingPattern: "", restrictions: "",
    dislikes: "", favorites: "", budget: "", cookingSkill: "",
    cookingTime: "", healthConditions: "", sleepEnergy: "", obstacles: "",
  });
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [currentInputType, setCurrentInputType] = useState("text");
  const [showOptions, setShowOptions] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showMagic, setShowMagic] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const steps = [
    { message: "Hello.", delay: 100, showInput: false },
    { message: "This is hungrX.", delay: 100, showInput: false },
    { message: "What's your name?", field: "name", inputType: "text", placeholder: "Your Name", delay: 100 },
    { message: "Hello, [name]. Your age?", field: "age", inputType: "number", placeholder: "Your Age", delay: 100 },
    { message: "Biological sex?", field: "gender", inputType: "select", options: ["Male", "Female", "Other"], delay: 100 },
    { message: "Height in cm?", field: "height", inputType: "number", placeholder: "Your Height", delay: 100 },
    { message: "Weight in kg?", field: "weight", inputType: "number", placeholder: "Your Weight", delay: 100 },
    { message: "Primary goal?", field: "primaryGoal", inputType: "select", options: ["Lose Weight", "Gain Weight", "Maintain Weight"], delay: 100 },
    { message: "Specific target?", field: "specificTarget", inputType: "text", placeholder: "e.g., Lose 10kg, Gain 5kg muscle", delay: 100 },
    { message: "Secondary goals?", field: "secondaryGoals", inputType: "text", placeholder: "e.g., Better sleep, more energy", delay: 100 },
    { message: "Activity level?", field: "activityLevel", inputType: "select", options: ["Sedentary", "Lightly Active", "Moderately Active", "Very Active", "Extremely Active"], delay: 100 },
    { message: "Current eating pattern?", field: "eatingPattern", inputType: "text", placeholder: "e.g., 3 meals, intermittent fasting", delay: 100 },
    { message: "Dietary restrictions?", field: "restrictions", inputType: "text", placeholder: "e.g., Vegetarian, lactose intolerant, none", delay: 100 },
    { message: "Food dislikes?", field: "dislikes", inputType: "text", placeholder: "Foods you avoid", delay: 100 },
    { message: "Favorite & comfort foods?", field: "favorites", inputType: "text", placeholder: "Foods you love", delay: 100 },
    { message: "Daily food budget?", field: "budget", inputType: "text", placeholder: "e.g., ₹500/day", delay: 100 },
    { message: "Cooking skill & enjoyment?", field: "cookingSkill", inputType: "select", options: ["Beginner - Don't enjoy", "Beginner - Enjoy learning", "Intermediate", "Advanced - Love cooking"], delay: 100 },
    { message: "Time for cooking?", field: "cookingTime", inputType: "text", placeholder: "e.g., 30 min weekdays, 1hr weekends", delay: 100 },
    { message: "Health conditions & medications?", field: "healthConditions", inputType: "text", placeholder: "e.g., Diabetes, blood pressure meds, none", delay: 100 },
    { message: "Sleep & energy patterns?", field: "sleepEnergy", inputType: "text", placeholder: "e.g., 7hrs sleep, low energy afternoons", delay: 100 },
    { message: "Past obstacles?", field: "obstacles", inputType: "text", placeholder: "What held you back before?", delay: 100 },
    { message: "One more thing.", delay: 100, showInput: false },
  ];

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { scrollToBottom(); }, [messages, showInput, showOptions]);
  useEffect(() => { if (currentStep < steps.length) simulateTyping(); }, [currentStep]);
  useEffect(() => { if (showInput && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50); }, [showInput]);

  const simulateTyping = () => {
    setShowInput(false);
    setShowOptions(false);
    const step = steps[currentStep];
    let messageText = step.message;
    if (step.message.includes("[name]") && userData.name)
      messageText = step.message.replace("[name]", userData.name);
    setMessages((prev) => [...prev, { type: "bot", text: messageText }]);
    setIsCurrentlyTyping(true);
    setDisplayedText("");
    let charIndex = 0;
    const typeInterval = setInterval(() => {
      if (charIndex < messageText.length) {
        setDisplayedText(messageText.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsCurrentlyTyping(false);
        if (step.field) {
          setTimeout(() => {
            if (step.inputType === "select") setShowOptions(true);
            else { setCurrentInputType(step.inputType); setShowInput(true); }
          }, 100);
        } else if (currentStep < steps.length - 1) {
          setTimeout(() => setCurrentStep((prev) => prev + 1), step.delay);
        } else {
          setTimeout(() => {
            setShowMagic(true);
            setTimeout(() => setIsComplete(true), 300);
          }, step.delay);
        }
      }
    }, 50);
  };

  const handleSubmit = (value = inputValue) => {
    if (!value.toString().trim()) return;
    const step = steps[currentStep];
    setMessages((prev) => [...prev, { type: "user", text: value.toString() }]);
    setUserData((prev) => ({ ...prev, [step.field]: value }));
    setInputValue("");
    setShowInput(false);
    setShowOptions(false);
    setTimeout(() => setCurrentStep((prev) => prev + 1), 150);
  };

  const handleKeyPress = (e) => { if (e.key === "Enter") handleSubmit(); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ob-outer { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background-color: #1a1a1a; font-family: 'JetBrains Mono', monospace; -webkit-font-smoothing: antialiased; }
        .ob-frame { width: 100%; max-width: 100%; height: 100dvh; background-color: #000; position: relative; display: flex; flex-direction: column; overflow: hidden; }
        @media (min-width: 520px) { .ob-outer { padding: 20px; } .ob-frame { max-width: 375px; height: min(812px, calc(100dvh - 40px)); border-radius: 54px; padding: 14px; box-shadow: 0 50px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(186,218,85,0.2) inset; } }
        .ob-inner { width: 100%; height: 100%; background-color: #1a1a1a; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        @media (min-width: 520px) { .ob-inner { border-radius: 38px; } }
        .ob-scroll { flex: 1; overflow-y: auto; padding: 56px 24px 24px; scrollbar-width: none; -ms-overflow-style: none; }
        .ob-scroll::-webkit-scrollbar { display: none; }
        .ob-msg-bot { font-size: clamp(20px, 5.5vw, 28px); font-weight: 300; letter-spacing: -0.025em; line-height: 1.35; color: #bada55; word-break: break-word; }
        @media (min-width: 520px) { .ob-msg-bot { font-size: 26px; } }
        .ob-msg-user { display: inline-block; color: rgba(186,218,85,0.7); font-size: clamp(14px,4vw,20px); font-weight: 300; letter-spacing: -0.025em; line-height: 1.3; font-style: italic; margin-right: 16px; word-break: break-word; }
        .ob-msg-row { margin-bottom: 12px; animation: obFade 0.2s ease-out forwards; opacity: 0; }
        .ob-msg-row-user { margin-bottom: 20px; text-align: right; animation: obFade 0.2s ease-out forwards; opacity: 0; }
        .ob-cursor { display: inline-block; width: 10px; height: 2px; background-color: #bada55; margin-left: 2px; vertical-align: baseline; animation: obBlink 1s ease-in-out infinite; }
        .ob-options { margin-top: 8px; animation: obFade 0.2s ease-out forwards; }
        .ob-opt-btn { display: block; width: 100%; text-align: left; padding: 15px 0; font-size: clamp(13px,3.8vw,16px); font-weight: 400; letter-spacing: -0.01em; background: transparent; border: none; color: #bada55; cursor: pointer; transition: color 0.15s ease, padding-left 0.15s ease; font-family: 'JetBrains Mono', monospace; animation: obFade 0.2s ease-out forwards; opacity: 0; min-height: 48px; }
        .ob-opt-btn:active, .ob-opt-btn:hover { color: #fff; padding-left: 8px; }
        .ob-opt-border { border-bottom: 1px solid rgba(186,218,85,0.18); }
        .ob-complete { padding: 40px 0; text-align: center; animation: obFade 0.3s ease-out forwards; opacity: 0; }
        .ob-complete-title { font-size: clamp(20px,5.5vw,28px); font-weight: 500; letter-spacing: -0.03em; color: #bada55; margin: 0 0 6px 0; }
        .ob-complete-sub { font-size: clamp(13px,3.8vw,17px); color: #666; margin: 0 0 32px 0; }
        .ob-start-btn { width: 100%; padding: 16px; border-radius: 12px; background-color: #bada55; border: none; font-size: clamp(14px,4vw,17px); font-weight: 500; letter-spacing: -0.01em; color: #000; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; font-family: 'JetBrains Mono', monospace; min-height: 52px; }
        .ob-start-btn:hover { transform: scale(1.02); box-shadow: 0 4px 20px rgba(186,218,85,0.4); }
        .ob-start-btn:active { transform: scale(0.98); }
        .ob-input-bar { padding: 14px 20px 28px; background-color: #1a1a1a; position: sticky; bottom: 0; z-index: 10; animation: obSlide 0.2s ease-out forwards; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) { .ob-input-bar { padding-bottom: max(28px, env(safe-area-inset-bottom)); } }
        .ob-input-wrap { display: flex; align-items: center; background-color: #2a2a2a; border-radius: 28px; padding: 0 8px 0 18px; transition: border 0.2s ease; }
        .ob-input-focused { border: 2px solid #bada55; }
        .ob-input-unfocused { border: 2px solid #333; }
        .ob-text-input { flex: 1; min-width: 0; padding: 13px 0; font-size: clamp(14px,3.8vw,16px); background: transparent; border: none; outline: none; color: #bada55; font-family: 'JetBrains Mono', monospace; font-weight: 400; letter-spacing: -0.01em; }
        .ob-send-btn { width: 44px; height: 44px; min-width: 44px; border-radius: 22px; border: none; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s ease, transform 0.2s ease; }
        .ob-send-active { background-color: #bada55; cursor: pointer; }
        .ob-send-inactive { background-color: #333; cursor: not-allowed; transform: scale(0.88); }
        .ob-home-bar { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 120px; height: 5px; background-color: #bada55; border-radius: 3px; pointer-events: none; }
        .ob-magic { padding: 60px 0; text-align: center; animation: obFade 0.3s ease forwards; }
        .ob-magic-circle { width: 64px; height: 64px; margin: 0 auto; border-radius: 50%; background-color: #bada55; display: flex; align-items: center; justify-content: center; animation: obPop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; transform: scale(0); }
        @keyframes obBlink { from, to { opacity: 1; } 50% { opacity: 0; } }
        @keyframes obFade { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes obSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes obPop { to { transform: scale(1); } }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        input::placeholder { color: #555; font-weight: 400; }
      `}</style>
      <div className="ob-outer">
        <div className="ob-frame">
          <div className="ob-inner">
            <div className="ob-scroll" style={{ paddingBottom: showInput ? '130px' : '50px' }}>
              {messages.map((msg, idx) => (
                <div key={idx} className={msg.type === 'user' ? 'ob-msg-row-user' : 'ob-msg-row'}>
                  {msg.type === 'bot' ? (
                    <div className="ob-msg-bot">
                      {idx === messages.length - 1 && isCurrentlyTyping ? displayedText : msg.text}
                      {idx === messages.length - 1 && <span className="ob-cursor" />}
                    </div>
                  ) : (
                    <div className="ob-msg-user">{msg.text}</div>
                  )}
                </div>
              ))}
              {showOptions && (
                <div className="ob-options">
                  {steps[currentStep].options.map((option, i) => (
                    <button key={option} onClick={() => handleSubmit(option)}
                      className={`ob-opt-btn ${i < steps[currentStep].options.length - 1 ? 'ob-opt-border' : ''}`}
                      style={{ animationDelay: `${i * 0.05}s` }}>
                      {option}
                    </button>
                  ))}
                </div>
              )}
              {showMagic && !isComplete && (
                <div className="ob-magic">
                  <div className="ob-magic-circle">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              )}
              {isComplete && (
                <div className="ob-complete">
                  <h2 className="ob-complete-title">Welcome, {userData.name}.</h2>
                  <p className="ob-complete-sub">Your journey begins.</p>
                  <button className="ob-start-btn" onClick={() => onComplete(userData)}>Get Started</button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {showInput && (
              <div className="ob-input-bar">
                <div className={`ob-input-wrap ${inputFocused ? 'ob-input-focused' : 'ob-input-unfocused'}`}>
                  <input ref={inputRef} type={currentInputType} value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)} onKeyPress={handleKeyPress}
                    onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                    placeholder={steps[currentStep]?.placeholder} className="ob-text-input" />
                  <button onClick={() => handleSubmit()} disabled={!inputValue.trim()}
                    className={`ob-send-btn ${inputValue.trim() ? 'ob-send-active' : 'ob-send-inactive'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(15deg)' }}>
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            <div className="ob-home-bar" />
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
const HungrXDashboard = ({ userData }) => {
  const [showRestaurants, setShowRestaurants] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [currentTime, setCurrentTime] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [showMicros, setShowMicros] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  const tdeeCalories = 2200;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ''));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const restaurants = [
    { id: 1, name: "McDonald's", icon: "M" }, { id: 2, name: "KFC", icon: "K" },
    { id: 3, name: "Subway", icon: "S" }, { id: 4, name: "Burger King", icon: "B" },
    { id: 5, name: "Domino's", icon: "D" }, { id: 6, name: "Pizza Hut", icon: "P" },
    { id: 7, name: "Starbucks", icon: "S" }, { id: 8, name: "Taco Bell", icon: "T" },
    { id: 9, name: "Wendy's", icon: "W" }, { id: 10, name: "Chipotle", icon: "C" },
  ];

  const mcdonaldsMenu = [
    { id: 1, name: "Big Mac", calories: 563, category: "Burgers", protein: 25, carbs: 45, fat: 30 },
    { id: 2, name: "Quarter Pounder", calories: 520, category: "Burgers", protein: 30, carbs: 42, fat: 26 },
    { id: 3, name: "McChicken", calories: 400, category: "Burgers", protein: 14, carbs: 39, fat: 21 },
    { id: 4, name: "Filet-O-Fish", calories: 380, category: "Burgers", protein: 15, carbs: 39, fat: 18 },
    { id: 5, name: "Medium Fries", calories: 340, category: "Sides", protein: 4, carbs: 44, fat: 16 },
    { id: 6, name: "McNuggets (6pc)", calories: 250, category: "Sides", protein: 15, carbs: 16, fat: 15 },
    { id: 7, name: "McFlurry", calories: 510, category: "Desserts", protein: 13, carbs: 76, fat: 16 },
    { id: 8, name: "Coca-Cola (Medium)", calories: 210, category: "Drinks", protein: 0, carbs: 58, fat: 0 },
  ];
  const kfcMenu = [
    { id: 1, name: "Original Recipe Chicken", calories: 320, category: "Chicken", protein: 29, carbs: 10, fat: 19 },
    { id: 2, name: "Zinger Burger", calories: 550, category: "Burgers", protein: 24, carbs: 55, fat: 26 },
    { id: 3, name: "Popcorn Chicken", calories: 400, category: "Chicken", protein: 19, carbs: 28, fat: 24 },
    { id: 4, name: "Coleslaw", calories: 150, category: "Sides", protein: 1, carbs: 21, fat: 7 },
    { id: 5, name: "Mashed Potatoes", calories: 120, category: "Sides", protein: 2, carbs: 18, fat: 4 },
    { id: 6, name: "Chicken Bucket (8pc)", calories: 2560, category: "Chicken", protein: 232, carbs: 80, fat: 152 },
  ];
  const subwayMenu = [
    { id: 1, name: "Italian BMT", calories: 410, category: "Subs", protein: 19, carbs: 45, fat: 16 },
    { id: 2, name: "Turkey Breast", calories: 280, category: "Subs", protein: 18, carbs: 46, fat: 3 },
    { id: 3, name: "Chicken Teriyaki", calories: 370, category: "Subs", protein: 25, carbs: 59, fat: 5 },
    { id: 4, name: "Veggie Delite", calories: 230, category: "Subs", protein: 9, carbs: 44, fat: 2 },
    { id: 5, name: "Meatball Marinara", calories: 480, category: "Subs", protein: 21, carbs: 61, fat: 17 },
    { id: 6, name: "Tuna", calories: 450, category: "Subs", protein: 20, carbs: 45, fat: 21 },
  ];
  const burgerKingMenu = [
    { id: 1, name: "Whopper", calories: 657, category: "Burgers", protein: 28, carbs: 49, fat: 40 },
    { id: 2, name: "Chicken Royale", calories: 670, category: "Burgers", protein: 28, carbs: 54, fat: 40 },
    { id: 3, name: "Bacon King", calories: 1040, category: "Burgers", protein: 57, carbs: 49, fat: 68 },
    { id: 4, name: "Onion Rings", calories: 410, category: "Sides", protein: 5, carbs: 53, fat: 20 },
    { id: 5, name: "Chicken Fries", calories: 280, category: "Sides", protein: 13, carbs: 20, fat: 17 },
    { id: 6, name: "Hershey's Sundae", calories: 310, category: "Desserts", protein: 7, carbs: 50, fat: 10 },
  ];
  const dominosMenu = [
    { id: 1, name: "Pepperoni Pizza (Slice)", calories: 298, category: "Pizza", protein: 13, carbs: 36, fat: 11 },
    { id: 2, name: "Margherita Pizza (Slice)", calories: 210, category: "Pizza", protein: 9, carbs: 27, fat: 7 },
    { id: 3, name: "Chicken BBQ Pizza (Slice)", calories: 265, category: "Pizza", protein: 12, carbs: 31, fat: 10 },
    { id: 4, name: "Garlic Bread", calories: 150, category: "Sides", protein: 4, carbs: 20, fat: 6 },
    { id: 5, name: "Cheesy Bread", calories: 180, category: "Sides", protein: 7, carbs: 20, fat: 8 },
    { id: 6, name: "Chicken Wings (6pc)", calories: 470, category: "Sides", protein: 44, carbs: 12, fat: 28 },
  ];
  const pizzaHutMenu = [
    { id: 1, name: "Meat Lovers (Slice)", calories: 340, category: "Pizza", protein: 16, carbs: 29, fat: 18 },
    { id: 2, name: "Veggie Supreme (Slice)", calories: 220, category: "Pizza", protein: 10, carbs: 30, fat: 7 },
    { id: 3, name: "Hawaiian Pizza (Slice)", calories: 250, category: "Pizza", protein: 12, carbs: 30, fat: 9 },
    { id: 4, name: "Breadsticks", calories: 140, category: "Sides", protein: 4, carbs: 20, fat: 5 },
    { id: 5, name: "Pasta Alfredo", calories: 520, category: "Pasta", protein: 18, carbs: 55, fat: 24 },
    { id: 6, name: "Cinnamon Sticks", calories: 160, category: "Desserts", protein: 2, carbs: 24, fat: 6 },
  ];
  const starbucksMenu = [
    { id: 1, name: "Caffe Latte (Grande)", calories: 190, category: "Drinks", protein: 12, carbs: 18, fat: 7 },
    { id: 2, name: "Caramel Macchiato", calories: 250, category: "Drinks", protein: 10, carbs: 34, fat: 7 },
    { id: 3, name: "Frappuccino", calories: 420, category: "Drinks", protein: 5, carbs: 66, fat: 16 },
    { id: 4, name: "Croissant", calories: 260, category: "Bakery", protein: 5, carbs: 27, fat: 15 },
    { id: 5, name: "Blueberry Muffin", calories: 380, category: "Bakery", protein: 5, carbs: 54, fat: 16 },
    { id: 6, name: "Turkey Sandwich", calories: 330, category: "Food", protein: 20, carbs: 43, fat: 8 },
  ];
  const tacoBellMenu = [
    { id: 1, name: "Crunchy Taco", calories: 170, category: "Tacos", protein: 8, carbs: 13, fat: 9 },
    { id: 2, name: "Burrito Supreme", calories: 390, category: "Burritos", protein: 14, carbs: 51, fat: 13 },
    { id: 3, name: "Quesadilla", calories: 510, category: "Specialties", protein: 20, carbs: 39, fat: 28 },
    { id: 4, name: "Nachos Supreme", calories: 440, category: "Sides", protein: 13, carbs: 41, fat: 24 },
    { id: 5, name: "Chalupa", calories: 350, category: "Specialties", protein: 13, carbs: 30, fat: 19 },
    { id: 6, name: "Crunchwrap Supreme", calories: 530, category: "Specialties", protein: 16, carbs: 71, fat: 21 },
  ];
  const wendysMenu = [
    { id: 1, name: "Dave's Single", calories: 570, category: "Burgers", protein: 29, carbs: 39, fat: 34 },
    { id: 2, name: "Spicy Chicken Sandwich", calories: 510, category: "Burgers", protein: 28, carbs: 51, fat: 20 },
    { id: 3, name: "Baconator", calories: 950, category: "Burgers", protein: 57, carbs: 38, fat: 62 },
    { id: 4, name: "Chicken Nuggets (10pc)", calories: 450, category: "Sides", protein: 22, carbs: 30, fat: 28 },
    { id: 5, name: "Chili", calories: 240, category: "Sides", protein: 17, carbs: 23, fat: 7 },
    { id: 6, name: "Frosty (Medium)", calories: 470, category: "Desserts", protein: 12, carbs: 79, fat: 12 },
  ];
  const chipotleMenu = [
    { id: 1, name: "Chicken Burrito Bowl", calories: 665, category: "Bowls", protein: 42, carbs: 71, fat: 24 },
    { id: 2, name: "Steak Burrito", calories: 930, category: "Burritos", protein: 41, carbs: 110, fat: 32 },
    { id: 3, name: "Carnitas Tacos (3)", calories: 630, category: "Tacos", protein: 32, carbs: 60, fat: 27 },
    { id: 4, name: "Veggie Bowl", calories: 430, category: "Bowls", protein: 14, carbs: 68, fat: 13 },
    { id: 5, name: "Chips & Guacamole", calories: 510, category: "Sides", protein: 6, carbs: 52, fat: 32 },
    { id: 6, name: "Queso Blanco", calories: 120, category: "Sides", protein: 5, carbs: 4, fat: 10 },
  ];

  const getMenuForRestaurant = (restaurantId) => {
    const menus = { 1: mcdonaldsMenu, 2: kfcMenu, 3: subwayMenu, 4: burgerKingMenu, 5: dominosMenu, 6: pizzaHutMenu, 7: starbucksMenu, 8: tacoBellMenu, 9: wendysMenu, 10: chipotleMenu };
    return menus[restaurantId] || mcdonaldsMenu;
  };

  const addItem = (item) => { setSelectedItems([...selectedItems, item]); setTotalCalories(totalCalories + item.calories); };
  const removeItem = (index) => { const item = selectedItems[index]; setSelectedItems(selectedItems.filter((_, i) => i !== index)); setTotalCalories(totalCalories - item.calories); };
  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const isOpen = prev[category] === true;
      return isOpen ? { [category]: false } : { [category]: true };
    });
  };

  const caloriePercentage = (totalCalories / tdeeCalories) * 100;
  const isOverLimit = caloriePercentage > 100;
  const userName = userData?.name || "User";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes dashEntrance { from { opacity: 0; transform: scale(0.96) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes expandDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
        *, *::before, *::after { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }

        .db-outer {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #1a1a1a;
          font-family: 'JetBrains Mono', monospace;
          -webkit-font-smoothing: antialiased;
        }

        /* Mobile: full screen, no frame */
        .db-frame {
          width: 100%;
          max-width: 100%;
          height: 100dvh;
          background-color: #000;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: dashEntrance 0.4s cubic-bezier(0.34,1.2,0.64,1) forwards;
        }

        /* Desktop: centered phone card */
        @media (min-width: 520px) {
          .db-outer { padding: 20px; }
          .db-frame {
            max-width: 375px;
            height: min(812px, calc(100dvh - 40px));
            border-radius: 54px;
            padding: 14px;
            box-shadow: 0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(186,218,85,0.15) inset;
          }
        }

        .db-inner {
          width: 100%;
          height: 100%;
          background-color: #1e1e1e;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        @media (min-width: 520px) {
          .db-inner { border-radius: 40px; }
        }

        /* Hide fake status bar on mobile (real OS bar shows instead) */
        .db-statusbar { display: none; }
        @media (min-width: 520px) {
          .db-statusbar {
            display: flex;
            height: 44px;
            padding: 0 24px 8px;
            align-items: flex-end;
            justify-content: space-between;
            position: relative;
            z-index: 10;
            flex-shrink: 0;
          }
        }

        .db-scroll {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 80px;
          background-color: #1e1e1e;
        }
        .db-scroll::-webkit-scrollbar { display: none; }

        /* Find restaurants button — fixed at bottom */
        .db-fab {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 48px);
          max-width: 299px;
          z-index: 100;
        }
        @media (min-width: 520px) {
          .db-fab {
            position: absolute;
            bottom: 50px;
            left: 38px;
            right: 38px;
            width: auto;
            max-width: none;
            transform: none;
          }
        }

        .db-home-bar {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 134px;
          height: 5px;
          background-color: #bada55;
          border-radius: 3px;
          pointer-events: none;
          display: none;
        }
        @media (min-width: 520px) {
          .db-home-bar { display: block; }
        }
      `}</style>

      <div className="db-outer">
        <div className="db-frame">
          <div className="db-inner">

          {/* Status Bar — desktop only */}
          <div className="db-statusbar">
            <span style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", color: "#bada55", fontFamily: '"JetBrains Mono", monospace' }}>{currentTime}</span>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "150px", height: "30px", backgroundColor: "#000", borderRadius: "0 0 20px 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ display: "flex", gap: "1px", alignItems: "flex-end" }}>
                {[8, 11, 14, 17].map((h, i) => (<div key={i} style={{ width: "3px", height: `${h}px`, backgroundColor: "#bada55", borderRadius: "1px" }} />))}
              </div>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="#bada55"><path d="M8 2.4c2.7 0 5.2 1.1 7 2.9l-1.4 1.4C12.2 5.3 10.2 4.4 8 4.4s-4.2.9-5.6 2.3L1 5.3C2.8 3.5 5.3 2.4 8 2.4zm0 4c1.7 0 3.2.7 4.3 1.8L11 9.5c-.8-.8-1.9-1.3-3-1.3s-2.2.5-3 1.3L3.7 8.2C4.8 7.1 6.3 6.4 8 6.4zm0 4c.8 0 1.5.3 2 .9L8 13.5l-2-2.2c.5-.6 1.2-.9 2-.9z" /></svg>
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <div style={{ width: "24px", height: "12px", border: "1px solid #bada55", borderRadius: "3px", padding: "2px" }}>
                  <div style={{ width: "100%", height: "100%", backgroundColor: "#bada55", borderRadius: "1px" }} />
                </div>
                <div style={{ width: "2px", height: "5px", backgroundColor: "#bada55", borderRadius: "0 1px 1px 0" }} />
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="db-scroll">

            {/* Welcome Banner */}
            <div style={{ padding: "16px 24px 0", backgroundColor: "#252526" }}>
              <div style={{ fontSize: "10px", color: "#858585", letterSpacing: "0.1em" }}>
                <span>// </span><span style={{ color: "#ce9178" }}>welcome_back</span><span style={{ color: "#bada55" }}>("{userName}")</span>
              </div>
            </div>

            {/* TDEE Calories Header */}
            <div style={{ padding: "12px 24px 24px", borderBottom: "1px solid #3e3e42", backgroundColor: "#252526" }}>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", letterSpacing: "0.1em", fontWeight: 500 }}>
                  <span style={{ color: "#858585" }}>// </span><span style={{ color: "#569cd6" }}>DAILY_LIMIT</span>
                </span>
              </div>
              <div style={{ fontSize: "48px", fontWeight: 300, color: "#bada55", letterSpacing: "-0.03em", fontFamily: '"JetBrains Mono", monospace' }}>
                {totalCalories}<span style={{ fontSize: "24px", color: "#858585" }}> / {tdeeCalories}</span>
              </div>
              <div style={{ marginTop: "12px", height: "4px", backgroundColor: "#3e3e42", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(caloriePercentage, 100)}%`, height: "100%", backgroundColor: isOverLimit ? "#f48771" : "#bada55", transition: "all 0.3s ease" }} />
              </div>
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#858585" }}>
                {isOverLimit ? (<span style={{ color: "#f48771" }}>// OVER_LIMIT: +{totalCalories - tdeeCalories} cal</span>) : (<span>// REMAINING: {tdeeCalories - totalCalories} cal</span>)}
              </div>
            </div>

            {/* Macros */}
            <div style={{ borderBottom: "1px solid #3e3e42" }}>
              <button onClick={() => setShowMacros(!showMacros)} style={{ width: "100%", padding: "16px 24px", backgroundColor: "#252526", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: '"JetBrains Mono", monospace' }}>
                <div style={{ fontSize: "10px", letterSpacing: "0.1em", fontWeight: 500, color: "#858585" }}><span>// </span><span style={{ color: "#569cd6" }}>MACROS</span></div>
                <span style={{ fontSize: "16px", color: "#569cd6", transition: "transform 0.3s ease", transform: showMacros ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </button>
              {showMacros && (
                <div style={{ padding: "16px 24px", backgroundColor: "#1e1e1e", animation: "expandDown 0.3s ease-out" }}>
                  {totalCalories > 0 ? (
                    <div style={{ display: "grid", gap: "16px" }}>
                      {[
                        { label: "Protein", color: "#6ec46e", value: selectedItems.reduce((s, i) => s + (i.protein || 0), 0), goal: Math.round(tdeeCalories * 0.3 / 4), unit: "g" },
                        { label: "Carbs", color: "#5fa3e0", value: selectedItems.reduce((s, i) => s + (i.carbs || 0), 0), goal: Math.round(tdeeCalories * 0.4 / 4), unit: "g" },
                        { label: "Fat", color: "#e0b75f", value: selectedItems.reduce((s, i) => s + (i.fat || 0), 0), goal: Math.round(tdeeCalories * 0.3 / 9), unit: "g" },
                      ].map(({ label, color, value, goal, unit }) => (
                        <div key={label}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{ width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px", flexShrink: 0 }} />
                            <span style={{ fontSize: "11px", color: "#d4d4d4", letterSpacing: "0.03em" }}>{label}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "#858585", marginBottom: "8px", paddingLeft: "20px" }}>{value}{unit} / {goal}{unit}</div>
                          <div style={{ height: "3px", backgroundColor: "#3e3e42", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min((value / goal) * 100, 100)}%`, height: "100%", backgroundColor: color, transition: "width 0.3s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (<div style={{ textAlign: "center", padding: "16px", fontSize: "11px", color: "#858585", fontStyle: "italic" }}>// start_logging_to_track_macros</div>)}
                </div>
              )}
            </div>

            {/* Micros */}
            <div style={{ borderBottom: "1px solid #3e3e42" }}>
              <button onClick={() => setShowMicros(!showMicros)} style={{ width: "100%", padding: "16px 24px", backgroundColor: "#252526", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: '"JetBrains Mono", monospace' }}>
                <div style={{ fontSize: "10px", letterSpacing: "0.1em", fontWeight: 500, color: "#858585" }}><span>// </span><span style={{ color: "#569cd6" }}>MICROS</span></div>
                <span style={{ fontSize: "16px", color: "#569cd6", transition: "transform 0.3s ease", transform: showMicros ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </button>
              {showMicros && (
                <div style={{ padding: "16px 24px", backgroundColor: "#1e1e1e", animation: "expandDown 0.3s ease-out" }}>
                  {totalCalories > 0 ? (
                    <div style={{ display: "grid", gap: "16px" }}>
                      {[
                        { label: "Sodium", color: "#ce9178", value: "850", goal: "2300", unit: "mg" },
                        { label: "Fiber", color: "#9cdcfe", value: "8", goal: "30", unit: "g" },
                        { label: "Sugar", color: "#c586c0", value: "18", goal: "50", unit: "g" },
                        { label: "Cholesterol", color: "#dcdcaa", value: "95", goal: "300", unit: "mg" },
                      ].map(({ label, color, value, goal, unit }) => (
                        <div key={label}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{ width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px", flexShrink: 0 }} />
                            <span style={{ fontSize: "11px", color: "#d4d4d4", letterSpacing: "0.03em" }}>{label}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "#858585", marginBottom: "8px", paddingLeft: "20px" }}>{value} / {goal}{unit}</div>
                          <div style={{ height: "3px", backgroundColor: "#3e3e42", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min((parseInt(value) / parseInt(goal)) * 100, 100)}%`, height: "100%", backgroundColor: color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (<div style={{ textAlign: "center", padding: "16px", fontSize: "11px", color: "#858585", fontStyle: "italic" }}>// start_logging_to_track_micros</div>)}
                </div>
              )}
            </div>

            {/* Meal History */}
            <div style={{ borderBottom: "1px solid #3e3e42" }}>
              <button onClick={() => setShowHistory(!showHistory)} style={{ width: "100%", padding: "20px 24px", backgroundColor: "#252526", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: '"JetBrains Mono", monospace' }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", letterSpacing: "0.1em", fontWeight: 500 }}><span style={{ color: "#858585" }}>// </span><span style={{ color: "#569cd6" }}>MEAL_HISTORY</span></span>
                  <span style={{ fontSize: "11px", color: "#bada55" }}>({selectedItems.length})</span>
                </div>
                <span style={{ fontSize: "16px", color: "#bada55", transition: "transform 0.3s ease", transform: showHistory ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </button>
              {showHistory && (
                <div style={{ padding: "0 24px 24px", animation: "expandDown 0.3s ease-out", backgroundColor: "#1e1e1e" }}>
                  {selectedItems.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#858585", fontSize: "12px", fontStyle: "italic" }}>// no_meals_logged</div>
                  ) : (
                    <div style={{ display: "grid", gap: "8px" }}>
                      {selectedItems.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#252526", border: "1px solid #3e3e42", borderRadius: "4px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                            <span style={{ fontSize: "13px", color: "#bada55" }}>{item.name}</span>
                            <span style={{ fontSize: "10px", color: "#858585", letterSpacing: "0.05em" }}>{selectedRestaurant?.name || "McDonald's"}</span>
                            {item.protein !== undefined && (
                              <div style={{ display: "flex", gap: "12px", fontSize: "9px", color: "#858585", letterSpacing: "0.05em" }}>
                                <span>P: {item.protein}g</span><span>C: {item.carbs}g</span><span>F: {item.fat}g</span>
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "12px", color: "#ce9178", fontWeight: 500 }}>{item.calories}</span>
                            <button onClick={() => removeItem(idx)} style={{ padding: "6px 10px", backgroundColor: "transparent", border: "1px solid #f48771", borderRadius: "2px", color: "#f48771", fontSize: "10px", cursor: "pointer", fontFamily: '"JetBrains Mono", monospace' }}>REMOVE</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Restaurant Finder */}
            <div style={{ padding: "24px" }}>
              {!showRestaurants ? (
                <div className="db-fab">
                  <button onClick={() => setShowRestaurants(true)} style={{ width: "100%", padding: "14px 12px", backgroundColor: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", color: "#bada55", fontSize: "11px", fontWeight: 400, letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.2s ease", fontFamily: '"JetBrains Mono", monospace', textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                    onMouseEnter={(e) => { e.target.style.backgroundColor = "rgba(186,218,85,0.05)"; e.target.style.borderColor = "#bada55"; }}
                    onMouseLeave={(e) => { e.target.style.backgroundColor = "#252526"; e.target.style.borderColor = "#3e3e42"; }}>
                    <span style={{ fontSize: "9px", color: "#858585" }}>// function</span>
                    <span>findRestaurants()</span>
                  </button>
                </div>
              ) : !selectedRestaurant ? (
                <div>
                  <div style={{ marginBottom: "16px", fontSize: "11px", letterSpacing: "0.1em", fontWeight: 500, paddingBottom: "8px", borderBottom: "1px solid #3e3e42" }}>
                    <span style={{ color: "#858585" }}>// </span><span style={{ color: "#569cd6" }}>NEARBY_RESTAURANTS</span>
                  </div>
                  <div style={{ display: "grid", gap: "10px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
                    {restaurants.map((restaurant) => (
                      <button key={restaurant.id} onClick={() => setSelectedRestaurant(restaurant)} style={{ width: "100%", padding: "14px 16px", backgroundColor: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", color: "#bada55", fontSize: "14px", fontWeight: 300, cursor: "pointer", transition: "all 0.2s ease", fontFamily: '"JetBrains Mono", monospace', display: "flex", alignItems: "center", gap: "14px", textAlign: "left" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(186,218,85,0.05)"; e.currentTarget.style.borderColor = "#bada55"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#252526"; e.currentTarget.style.borderColor = "#3e3e42"; }}>
                        <div style={{ width: "36px", height: "36px", backgroundColor: "#bada55", color: "#000", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 600, flexShrink: 0 }}>{restaurant.icon}</div>
                        {restaurant.name}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowRestaurants(false)} style={{ marginTop: "12px", padding: "12px", backgroundColor: "transparent", border: "1px solid #858585", borderRadius: "4px", color: "#858585", fontSize: "12px", cursor: "pointer", width: "100%", fontFamily: '"JetBrains Mono", monospace' }}>‹ BACK</button>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: "16px", fontSize: "12px", letterSpacing: "0.1em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#569cd6" }}>{selectedRestaurant.name.toUpperCase()}_MENU</span>
                    <button onClick={() => setSelectedRestaurant(null)} style={{ padding: "6px 12px", backgroundColor: "transparent", border: "1px solid #858585", borderRadius: "2px", color: "#858585", fontSize: "10px", cursor: "pointer", fontFamily: '"JetBrains Mono", monospace' }}>‹ BACK</button>
                  </div>
                  {selectedItems.length > 0 && (
                    <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#252526", borderRadius: "4px" }}>
                      <div style={{ fontSize: "10px", color: "#858585", marginBottom: "8px", letterSpacing: "0.1em" }}>SELECTED_ITEMS</div>
                      {selectedItems.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: idx < selectedItems.length - 1 ? "1px solid #3e3e42" : "none" }}>
                          <span style={{ fontSize: "12px", color: "#bada55" }}>{item.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "12px", color: "#858585" }}>{item.calories} cal</span>
                            <button onClick={() => removeItem(idx)} style={{ padding: "4px 8px", backgroundColor: "transparent", border: "1px solid #f48771", borderRadius: "2px", color: "#f48771", fontSize: "10px", cursor: "pointer", fontFamily: '"JetBrains Mono", monospace' }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "grid", gap: "20px" }}>
                    {Object.entries(getMenuForRestaurant(selectedRestaurant.id).reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {})).map(([category, items]) => {
                      const isExpanded = expandedCategories[category] === true;
                      return (
                        <div key={category}>
                          <button onClick={() => toggleCategory(category)} style={{ width: "100%", fontSize: "10px", letterSpacing: "0.1em", marginBottom: isExpanded ? "10px" : "0", fontWeight: 500, paddingBottom: "6px", backgroundColor: "transparent", border: "none", borderBottom: "1px solid #3e3e42", cursor: "pointer", fontFamily: '"JetBrains Mono", monospace', display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s ease" }}>
                            <div><span style={{ color: "#858585" }}>// </span><span style={{ color: "#569cd6" }}>{category.toUpperCase()}</span></div>
                            <span style={{ fontSize: "14px", color: "#569cd6", transition: "transform 0.3s ease", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                          </button>
                          {isExpanded && (
                            <div style={{ display: "grid", gap: "8px" }}>
                              {items.map((item) => (
                                <button key={item.id} onClick={() => addItem(item)} style={{ padding: "12px", backgroundColor: "#252526", border: "1px solid #3e3e42", borderRadius: "4px", color: "#bada55", fontSize: "13px", fontWeight: 300, cursor: "pointer", transition: "all 0.2s ease", fontFamily: '"JetBrains Mono", monospace', display: "flex", flexDirection: "column", gap: "6px" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#bada55"; e.currentTarget.style.backgroundColor = "rgba(186,218,85,0.05)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#3e3e42"; e.currentTarget.style.backgroundColor = "#252526"; }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>{item.name}</span><span style={{ fontSize: "12px", color: "#ce9178" }}>{item.calories} cal</span>
                                  </div>
                                  <div style={{ display: "flex", gap: "12px", fontSize: "9px", color: "#858585", letterSpacing: "0.05em" }}>
                                    <span>P: {item.protein}g</span><span>C: {item.carbs}g</span><span>F: {item.fat}g</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>{/* end db-scroll */}

          {/* Home bar — desktop only via CSS */}
          <div className="db-home-bar" />

          </div>{/* end db-inner */}
        </div>{/* end db-frame */}
      </div>{/* end db-outer */}
    </>
  );
};

// ─────────────────────────────────────────────
// ROOT — handles page routing
// ─────────────────────────────────────────────
const HungrXApp = () => {
  const [page, setPage] = useState("onboarding"); // "onboarding" | "dashboard"
  const [userData, setUserData] = useState(null);

  const handleOnboardingComplete = (data) => {
    setUserData(data);
    setPage("dashboard");
  };

  if (page === "dashboard") {
    return <HungrXDashboard userData={userData} />;
  }

  return <HungrXOnboarding onComplete={handleOnboardingComplete} />;
};

export default HungrXApp;