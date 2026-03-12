import { useState } from "react";
import HungrXOnboarding from "./HungrXOnboarding";
import HungrXDashboard from "./HungrXDashboard";
import HungrXLogin from "./HungrXLogin";

function App() {
  const [screen, setScreen] = useState(() => {
    if (sessionStorage.getItem("hungrxSession")) return "dashboard";
    return "login";
  });
  const [userData, setUserData] = useState(() => {
    const saved = sessionStorage.getItem("hungrxUserData");
    return saved ? JSON.parse(saved) : null;
  });
  const [prefillName, setPrefillName] = useState("");

  if (screen === "dashboard")
    return <HungrXDashboard userData={userData || {}} onLogout={() => {
      sessionStorage.clear();
      localStorage.removeItem("hungrxUserId");
      setUserData(null);
      setScreen("login");
    }} />;

  if (screen === "onboarding")
    return <HungrXOnboarding prefill={{ name: prefillName }} onComplete={() => setScreen("login")} />;

  return (
    <HungrXLogin
      prefillName={prefillName}
      onLogin={(data) => {
        sessionStorage.setItem("hungrxSession", "1");
        sessionStorage.setItem("hungrxUserData", JSON.stringify(data));
        localStorage.setItem("hungrxUserId", data.userId);
        setUserData(data);
        setScreen("dashboard");
      }}
      onNewUser={(name) => {
        setPrefillName(name);
        setScreen("onboarding");
      }}
    />
  );
}

export default App;