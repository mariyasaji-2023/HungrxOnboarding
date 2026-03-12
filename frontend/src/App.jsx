import { useState } from "react";
import HungrXOnboarding from "./HungrXOnboarding";
import HungrXDashboard from "./HungrXDashboard";
import HungrXLogin from "./HungrXLogin";

function App() {
  // sessionStorage persists on refresh but clears when tab/browser closes
  const [screen, setScreen] = useState(() => {
    return sessionStorage.getItem("hungrxSession") ? "dashboard" : "login";
  });
  const [userData, setUserData] = useState(() => {
    const saved = sessionStorage.getItem("hungrxUserData");
    return saved ? JSON.parse(saved) : null;
  });
  const [onboardingPrefill, setOnboardingPrefill] = useState({});

  const handleLogout = () => {
    sessionStorage.removeItem("hungrxSession");
    sessionStorage.removeItem("hungrxUserData");
    setUserData(null);
    setOnboardingPrefill({});
    setScreen("login");
  };

  if (screen === "dashboard")
    return <HungrXDashboard userData={userData || {}} onLogout={handleLogout} />;

  if (screen === "login")
    return (
      <HungrXLogin
        onLogin={(data) => {
          sessionStorage.setItem("hungrxSession", "1");
          sessionStorage.setItem("hungrxUserData", JSON.stringify(data));
          localStorage.setItem("hungrxUserId", data.userId); // keep for API calls
          setUserData(data);
          setScreen("dashboard");
        }}
        onNewUser={(credentials) => {
          setOnboardingPrefill(credentials);
          setScreen("onboarding");
        }}
      />
    );

  return (
    <HungrXOnboarding
      prefill={onboardingPrefill}
      onComplete={(data) => {
        sessionStorage.setItem("hungrxSession", "1");
        sessionStorage.setItem("hungrxUserData", JSON.stringify(data));
        localStorage.setItem("hungrxUserId", data.userId);
        setUserData(data);
        setScreen("dashboard");
      }}
    />
  );
}

export default App;