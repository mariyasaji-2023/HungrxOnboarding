import { useState, useEffect, useRef } from "react";

const HungrXOnboarding = ({ onComplete, prefill = {} }) => {
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState({
    name: prefill.name || "", age: "", gender: "", height: "", weight: "",
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
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const allSteps = [
    { message: "Hello.", delay: 100, showInput: false },
    { message: "This is hungrX.", delay: 100, showInput: false },
    { message: "What's your name?", field: "name", inputType: "text", placeholder: "Your Name", delay: 100 },
    { message: "Hello, [name].", delay: 100, showInput: false },
    { message: "Your age?", field: "age", inputType: "number", placeholder: "Your Age", delay: 100 },
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

  const steps = prefill.name
    ? allSteps.filter((s) => s.field !== "name" && s.message !== "Hello." && s.message !== "This is hungrX.")
    : allSteps;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, showInput, showOptions, isComplete, showMagic]);

  // Extra scroll when completion renders — DOM needs time
  useEffect(() => {
    if (isComplete) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 500);
    }
  }, [isComplete]);

  const stepFiredRef = useRef(-1);

  useEffect(() => {
    if (currentStep < steps.length) simulateTyping();
  }, [currentStep]);

  useEffect(() => {
    if (showInput && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showInput]);

  const simulateTyping = () => {
    if (stepFiredRef.current === currentStep) return;
    stepFiredRef.current = currentStep;
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

  const handleGetStarted = async () => {
    setIsLoading(true);
    setApiError("");
    try {
      const res = await fetch("http://localhost:5000/api/users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...userData, password: prefill.password || undefined }),
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem("hungrxUserId", result.data.userId);
        onComplete && onComplete({ ...userData, ...result.data });
      } else {
        setApiError("Something went wrong. Please try again.");
      }
    } catch (err) {
      setApiError("Cannot connect to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #root {
          height: 100%;
          width: 100%;
          background-color: #1a1a1a;
        }

        .hungrx-outer {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #1a1a1a;
          font-family: 'JetBrains Mono', monospace;
          -webkit-font-smoothing: antialiased;
        }

        .hungrx-frame {
          width: 100%;
          max-width: 100%;
          height: 100dvh;
          background-color: #000;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        @media (min-width: 520px) {
          .hungrx-outer { padding: 20px; }
          .hungrx-frame {
            max-width: 375px;
            height: min(812px, calc(100dvh - 40px));
            border-radius: 54px;
            padding: 14px;
            box-shadow: 0 50px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(186,218,85,0.2) inset;
          }
        }

        .hungrx-inner {
          width: 100%;
          height: 100%;
          background-color: #1a1a1a;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        @media (min-width: 520px) {
          .hungrx-inner { border-radius: 38px; }
        }

        .hungrx-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 56px 24px 24px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hungrx-scroll::-webkit-scrollbar { display: none; }

        @media (min-width: 520px) {
          .hungrx-scroll { padding: 60px 28px 24px; }
        }

        .msg-bot {
          font-size: clamp(20px, 5.5vw, 28px);
          font-weight: 300;
          letter-spacing: -0.025em;
          line-height: 1.35;
          color: #bada55;
          word-break: break-word;
        }

        @media (min-width: 520px) { .msg-bot { font-size: 26px; } }

        .msg-user {
          display: inline-block;
          color: rgba(186, 218, 85, 0.7);
          font-size: clamp(14px, 4vw, 20px);
          font-weight: 300;
          letter-spacing: -0.025em;
          line-height: 1.3;
          font-style: italic;
          margin-right: 16px;
          word-break: break-word;
        }

        @media (min-width: 520px) { .msg-user { font-size: 18px; } }

        .msg-row {
          margin-bottom: 12px;
          animation: quickFade 0.2s ease-out forwards;
          opacity: 0;
        }

        .msg-row-user {
          margin-bottom: 20px;
          text-align: right;
          animation: quickFade 0.2s ease-out forwards;
          opacity: 0;
        }

        .cursor-blink {
          display: inline-block;
          width: 10px;
          height: 2px;
          background-color: #bada55;
          margin-left: 2px;
          vertical-align: baseline;
          animation: blinkCursor 1s ease-in-out infinite;
        }

        .options-wrap {
          margin-top: 8px;
          animation: quickFade 0.2s ease-out forwards;
        }

        .option-btn {
          display: block;
          width: 100%;
          text-align: left;
          padding: 15px 0;
          font-size: clamp(13px, 3.8vw, 16px);
          font-weight: 400;
          letter-spacing: -0.01em;
          background: transparent;
          border: none;
          color: #bada55;
          cursor: pointer;
          transition: color 0.15s ease, padding-left 0.15s ease;
          font-family: 'JetBrains Mono', monospace;
          animation: quickOption 0.2s ease-out forwards;
          opacity: 0;
          min-height: 48px;
        }

        .option-btn:active, .option-btn:hover { color: #ffffff; padding-left: 8px; }
        .option-btn-border { border-bottom: 1px solid rgba(186,218,85,0.18); }

        .complete-wrap {
          padding: 40px 0 80px;
          text-align: center;
          animation: quickFade 0.3s ease-out forwards;
          opacity: 0;
        }

        .complete-title {
          font-size: clamp(20px, 5.5vw, 28px);
          font-weight: 500;
          letter-spacing: -0.03em;
          color: #bada55;
          margin: 0 0 6px 0;
        }

        .complete-sub {
          font-size: clamp(13px, 3.8vw, 17px);
          color: #666666;
          margin: 0 0 32px 0;
        }

        .start-btn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          background-color: #bada55;
          border: none;
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #000;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          font-family: 'JetBrains Mono', monospace;
          min-height: 52px;
        }

        .start-btn:hover { transform: scale(1.02); box-shadow: 0 4px 20px rgba(186,218,85,0.4); }
        .start-btn:active { transform: scale(0.98); }
        .start-btn:disabled { cursor: not-allowed; }

        .input-bar {
          padding: 14px 20px 28px;
          background-color: #1a1a1a;
          position: sticky;
          bottom: 0;
          z-index: 10;
          animation: quickSlide 0.2s ease-out forwards;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .input-bar { padding-bottom: max(28px, env(safe-area-inset-bottom)); }
        }

        @media (max-width: 360px) { .input-bar { padding: 12px 14px 24px; } }

        .input-wrap {
          display: flex;
          align-items: center;
          background-color: #2a2a2a;
          border-radius: 28px;
          padding: 0 8px 0 18px;
          transition: border 0.2s ease;
        }

        .input-focused { border: 2px solid #bada55; }
        .input-unfocused { border: 2px solid #333333; }

        .text-input {
          flex: 1;
          min-width: 0;
          padding: 13px 0;
          font-size: clamp(14px, 3.8vw, 16px);
          background: transparent;
          border: none;
          outline: none;
          color: #bada55;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 400;
          letter-spacing: -0.01em;
        }

        .send-btn {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 22px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .send-active { background-color: #bada55; cursor: pointer; transform: scale(1); }
        .send-inactive { background-color: #333; cursor: not-allowed; transform: scale(0.88); }

        .home-bar {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 5px;
          background-color: #bada55;
          border-radius: 3px;
          pointer-events: none;
        }

        .magic-wrap {
          padding: 60px 0;
          text-align: center;
          animation: quickFade 0.3s ease forwards;
        }

        .magic-circle {
          width: 64px;
          height: 64px;
          margin: 0 auto;
          border-radius: 50%;
          background-color: #bada55;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: quickPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          transform: scale(0);
        }

        .api-error {
          color: #f48771;
          font-size: 13px;
          margin-bottom: 16px;
          font-family: 'JetBrains Mono', monospace;
        }

        @keyframes blinkCursor { from, to { opacity: 1; } 50% { opacity: 0; } }
        @keyframes quickFade { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes quickOption { to { opacity: 1; } }
        @keyframes quickSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes quickPop { to { transform: scale(1); } }

        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        input::placeholder { color: #555; font-weight: 400; }
      `}</style>

      <div className="hungrx-outer">
        <div className="hungrx-frame">
          <div className="hungrx-inner">
            <div className="hungrx-scroll" style={{ paddingBottom: showInput ? "130px" : "50px" }}>
              {messages.map((msg, idx) => (
                <div key={idx} className={msg.type === "user" ? "msg-row-user" : "msg-row"}>
                  {msg.type === "bot" ? (
                    <div className="msg-bot">
                      {idx === messages.length - 1 && isCurrentlyTyping ? displayedText : msg.text}
                      {idx === messages.length - 1 && <span className="cursor-blink" />}
                    </div>
                  ) : (
                    <div className="msg-user">{msg.text}</div>
                  )}
                </div>
              ))}

              {showOptions && (
                <div className="options-wrap">
                  {steps[currentStep].options.map((option, i) => (
                    <button
                      key={option}
                      onClick={() => handleSubmit(option)}
                      className={`option-btn ${i < steps[currentStep].options.length - 1 ? "option-btn-border" : ""}`}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {showMagic && !isComplete && (
                <div className="magic-wrap">
                  <div className="magic-circle">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                      stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              )}

              {isComplete && (
                <div className="complete-wrap">
                  <h2 className="complete-title">Welcome, {userData.name}.</h2>
                  <p className="complete-sub">Your journey begins.</p>
                  {apiError && <p className="api-error">{apiError}</p>}
                  <button
                    className="start-btn"
                    onClick={handleGetStarted}
                    disabled={isLoading}
                    style={{ opacity: isLoading ? 0.7 : 1 }}
                  >
                    {isLoading ? "Saving..." : "Get Started"}
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {showInput && (
              <div className="input-bar">
                <div className={`input-wrap ${inputFocused ? "input-focused" : "input-unfocused"}`}>
                  <input
                    ref={inputRef}
                    type={currentInputType}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder={steps[currentStep]?.placeholder}
                    className="text-input"
                  />
                  <button
                    onClick={() => handleSubmit()}
                    disabled={!inputValue.trim()}
                    className={`send-btn ${inputValue.trim() ? "send-active" : "send-inactive"}`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                      stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: "rotate(15deg)" }}>
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <div className="home-bar" />
          </div>
        </div>
      </div>
    </>
  );
};

export default HungrXOnboarding;