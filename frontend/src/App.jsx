import { useState, useEffect } from "react";
import HungrXOnboarding from "./HungrXOnboarding";
import HungrXDashboard from "./HungrXDashboard";

const BACKEND_URL = "https://hungrxonboarding.onrender.com";

function App() {
  const [screen, setScreen] = useState("loading");
  const [userData, setUserData] = useState(null);

  // On mount — check if user already logged in, load their data
  useEffect(() => {
    const userId = localStorage.getItem("hungrxUserId");
    if (!userId) {
      setScreen("onboarding");
      return;
    }
    fetch(`${BACKEND_URL}/api/users/${userId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setUserData(json.data);
          setScreen("dashboard");
        } else {
          localStorage.removeItem("hungrxUserId");
          setScreen("onboarding");
        }
      })
      .catch(() => {
        // Network error — still show dashboard
        setScreen("dashboard");
      });
  }, []);

  const handleGetStarted = (data) => {
    setUserData(data);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("hungrxUserId");
    setUserData(null);
    setScreen("onboarding");
  };

  if (screen === "loading") {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#bada55",
        fontSize: "13px",
        letterSpacing: "0.1em",
      }}>
        // loading...
      </div>
    );
  }

  if (screen === "dashboard") {
    return <HungrXDashboard userData={userData || {}} onLogout={handleLogout} />;
  }

  return <HungrXOnboarding onComplete={handleGetStarted} />;
}

export default App;