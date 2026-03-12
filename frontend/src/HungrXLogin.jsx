import { useState, useEffect } from "react";

const BACKEND_URL = "https://hungrxonboarding.onrender.com";

const HungrXLogin = ({ onLogin, onNewUser }) => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", ""));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    if (!name.trim() || !password.trim()) { setError("all fields required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem("hungrxUserId", json.data.userId);
        onLogin && onLogin(json.data);
      } else if (json.code === "USER_NOT_FOUND") {
        onNewUser && onNewUser({ name: name.trim(), password });
      } else {
        setError(json.message || "invalid credentials.");
      }
    } catch {
      setError("cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const inp = (field) => ({
    width: "100%", padding: "14px 16px",
    background: focused === field ? "#2a2a2a" : "#252526",
    border: `1px solid ${focused === field ? "#bada55" : "#3e3e42"}`,
    borderRadius: "6px", outline: "none",
    color: "#bada55", fontSize: "14px",
    fontFamily: "'JetBrains Mono', monospace",
    transition: "border-color 0.2s ease, background 0.2s ease",
    boxSizing: "border-box",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; background: #1e1e1e; }
        input::placeholder { color: #3e3e42; font-family: 'JetBrains Mono', monospace; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .lf { animation: fadeUp 0.3s ease forwards; opacity: 0; }
        .lf:nth-child(1){animation-delay:0.1s} .lf:nth-child(2){animation-delay:0.2s}
        .lf:nth-child(3){animation-delay:0.3s} .lf:nth-child(4){animation-delay:0.4s}
        .hx-login-btn:hover { background: rgba(186,218,85,0.08) !important; }
        .hx-login-btn:active { transform: scale(0.98); }
        @media (max-width: 550px) {
          .hx-outer { padding: 0 !important; }
          .hx-frame { max-width:100% !important; width:100% !important; height:100dvh !important; border-radius:0 !important; padding:0 !important; background: #1e1e1e !important; box-shadow: none !important; }
          .hx-inner { border-radius:0 !important; }
          .hx-statusbar { display: none !important; }
          .hx-homebar { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e1e1e", fontFamily: "'JetBrains Mono', monospace", padding: "20px" }} className="hx-outer">
        <div style={{ width: "375px", height: "min(812px, calc(100dvh - 40px))", background: "#000", borderRadius: "54px", padding: "14px", boxShadow: "0 50px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(186,218,85,0.2) inset", flexShrink: 0 }} className="hx-frame">
          <div style={{ width: "100%", height: "100%", background: "#1e1e1e", borderRadius: "40px", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }} className="hx-inner">

            {/* Status Bar */}
            <div className="hx-statusbar" style={{ height: "44px", padding: "0 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "8px", flexShrink: 0, position: "relative" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", color: "#bada55" }}>{currentTime}</span>
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "150px", height: "30px", background: "#000", borderRadius: "0 0 20px 20px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ display: "flex", gap: "1px", alignItems: "flex-end" }}>
                  {[8,11,14,17].map((h,i) => <div key={i} style={{ width: "3px", height: `${h}px`, background: "#bada55", borderRadius: "1px" }} />)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  <div style={{ width: "24px", height: "12px", border: "1px solid #bada55", borderRadius: "3px", padding: "2px" }}>
                    <div style={{ width: "100%", height: "100%", background: "#bada55", borderRadius: "1px" }} />
                  </div>
                  <div style={{ width: "2px", height: "5px", background: "#bada55", borderRadius: "0 1px 1px 0" }} />
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 28px 48px" }}>

              <div className="lf" style={{ marginBottom: "36px" }}>
                <div style={{ fontSize: "42px", fontWeight: 300, color: "#bada55", letterSpacing: "-0.04em", lineHeight: 1 }}>hungrX</div>
                <div style={{ fontSize: "10px", color: "#858585", marginTop: "6px", letterSpacing: "0.04em" }}>track. eat. repeat.</div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                <div className="lf">
                  <div style={{ fontSize: "8px", color: "#569cd6", letterSpacing: "0.12em", marginBottom: "6px" }}>NAME</div>
                  <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }}
                    onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                    placeholder="your name" style={inp("name")} autoComplete="off" />
                </div>

                <div className="lf" style={{ position: "relative" }}>
                  <div style={{ fontSize: "8px", color: "#569cd6", letterSpacing: "0.12em", marginBottom: "6px" }}>PASSWORD</div>
                  <input type={showPass ? "text" : "password"} value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
                    placeholder="••••••••" autoComplete="off"
                    style={{ ...inp("password"), paddingRight: "52px" }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: "absolute", right: "12px", bottom: "14px", background: "none", border: "none", color: "#858585", cursor: "pointer", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                    {showPass ? "hide" : "show"}
                  </button>
                </div>

                {error && (
                  <div style={{ fontSize: "10px", color: "#f48771", letterSpacing: "0.04em" }}>
                    <span style={{ color: "#858585" }}>// </span>{error}
                  </div>
                )}

                <div className="lf" style={{ marginTop: "4px" }}>
                  <button type="submit" className="hx-login-btn" disabled={loading}
                    style={{ width: "100%", padding: "16px", background: "transparent", border: `1px solid ${loading ? "#3e3e42" : "#bada55"}`, borderRadius: "6px", color: loading ? "#3e3e42" : "#bada55", fontSize: "13px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", transition: "all 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    {loading ? (
                      <>
                        <span style={{ fontSize: "9px", color: "#858585" }}>// authenticating</span>
                        <div style={{ display: "flex", gap: "3px" }}>
                          {[0,1,2].map(i => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#bada55", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                        </div>
                      </>
                    ) : "login()"}
                  </button>
                </div>
              </form>

              <div style={{ paddingTop: "32px", textAlign: "center" }}>
                <div style={{ fontSize: "9px", color: "#3e3e42", letterSpacing: "0.06em" }}>
                  <span style={{ color: "#569cd6" }}>// </span>v1.0.0 · hungrX nutrition os
                </div>
              </div>
            </div>

            <div className="hx-homebar" style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", width: "134px", height: "5px", background: "#bada55", borderRadius: "3px", pointerEvents: "none" }} />
          </div>
        </div>
      </div>
    </>
  );
};

export default HungrXLogin;