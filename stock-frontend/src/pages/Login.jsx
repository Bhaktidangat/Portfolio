import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login({ defaultMode = "login" }) {
  const [isSignupMode, setIsSignupMode] = useState(defaultMode === "signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("portfolio_user") === "true";
    if (isLoggedIn) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const submit = (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.setItem("use_jwt_auth", "false");
    localStorage.setItem("portfolio_user", "true");
    navigate("/", { replace: true });
  };

  return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={submit}>
        <h2>{isSignupMode ? "Sign Up" : "Login"}</h2>
        <div className="auth-toggle">
          <button
            type="button"
            className={!isSignupMode ? "active" : ""}
            onClick={() => setIsSignupMode(false)}
          >
            Login
          </button>
          <button
            type="button"
            className={isSignupMode ? "active" : ""}
            onClick={() => setIsSignupMode(true)}
          >
            Sign Up
          </button>
        </div>

        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn" type="submit">
          {isSignupMode ? "Create Account" : "Login"}
        </button>
        <a href="#" className="helper-link">
          Forgot password?
        </a>
      </form>
    </div>
  );
}
