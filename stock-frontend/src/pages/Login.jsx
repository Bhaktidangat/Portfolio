import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login({ defaultMode = "login" }) {
  const [isSignupMode, setIsSignupMode] = useState(defaultMode === "signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);
const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (isSignupMode) {
        const regRes = await fetch("https://portanalysis.duckdns.org/api/register/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const regData = await regRes.json();
        if (!regRes.ok) { setError(regData?.detail || "Registration failed."); setLoading(false); return; }
      }
      const response = await fetch("https://portanalysis.duckdns.org/api/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        localStorage.setItem("portfolio_user", "true");
        navigate("/", { replace: true });
      } else {
        setError("Invalid username or password.");
      }
    } catch {
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };
return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={submit}>
        <h2>{isSignupMode ? "Sign Up" : "Login"}</h2>
        <div className="auth-toggle">
          <button type="button" className={!isSignupMode ? "active" : ""} onClick={() => setIsSignupMode(false)}>Login</button>
          <button type="button" className={isSignupMode ? "active" : ""} onClick={() => setIsSignupMode(true)}>Sign Up</button>
        </div>
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ color: "red", marginTop: "8px" }}>{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Please wait..." : isSignupMode ? "Create Account" : "Login"}
        </button>
        <a href="#" className="helper-link">Forgot password?</a>
      </form>
    </div>
  );
}
