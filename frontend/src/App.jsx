import { useState } from "react";
import HungrXOnboarding from "./HungrXOnboarding";
import HungrXDashboard from "./HungrXDashboard";
import HungrXLogin from "./HungrXLogin";

function App() {
  const [screen, setScreen] = useState(() => {
    if (sessionStorage.getItem("hungrxSession")) return "dashboard";
    return "onboarding";
  });

  const [userData, setUserData] = useState(() => {
    const saved = sessionStorage.getItem("hungrxUserData");
    return saved ? JSON.parse(saved) : null;
  });
  const [onboardingPrefill, setOnboardingPrefill] = useState({});

  const handleLogout = () => {
    sessionStorage.removeItem("hungrxSession");
    sessionStorage.removeItem("hungrxUserData");
    localStorage.removeItem("hungrxUserId");
    setUserData(null);
    setScreen("onboarding");
  };

  if (screen === "dashboard")
    return <HungrXDashboard userData={userData || {}} onLogout={handleLogout} />;

  if (screen === "login")
    return (
      <HungrXLogin
        prefillName={onboardingPrefill?.name || ""}
        onLogin={(data) => {
          sessionStorage.setItem("hungrxSession", "1");
          sessionStorage.setItem("hungrxUserData", JSON.stringify(data));
          localStorage.setItem("hungrxUserId", data.userId);
          setUserData(data);
          setScreen("dashboard");
        }}
      />
    );

  return (
    <HungrXOnboarding
      prefill={{}}
      onComplete={(data) => {
        setOnboardingPrefill({ name: data?.name || "" });
        setScreen("login");
      }}
    />
  );
}

export default App;