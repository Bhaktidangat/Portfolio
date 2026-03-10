import { NavLink, useNavigate } from "react-router-dom";

const items = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/growth", label: "Growth" },
  { to: "/ml-analysis", label: "ML Analysis" },
  { to: "/gold-silver", label: "Gold Silver" },
  { to: "/bitcoin", label: "Bitcoin" },
  { to: "/compare", label: "Compare" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem("portfolio_user") === "true";

  const logout = () => {
    localStorage.removeItem("portfolio_user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("use_jwt_auth");
    navigate("/login", { replace: true });
  };

  const handleProtectedNav = (event, destination) => {
    if (isLoggedIn) return;
    event.preventDefault();
    navigate(destination, { replace: false });
  };

  return (
    <header className="navbar">
      <div className="brand-block">
        <p className="brand-kicker">Workspace</p>
        <h1 className="site-title">Portfolio Analytics</h1>
      </div>
      <nav className="nav-links">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            onClick={(event) => handleProtectedNav(event, "/login")}
          >
            {item.label}
          </NavLink>
        ))}
        {!isLoggedIn && (
          <div className="nav-auth">
            <NavLink
              to="/login"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              Login
            </NavLink>
            <NavLink
              to="/signup"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              Sign Up
            </NavLink>
          </div>
        )}
      </nav>
      {isLoggedIn ? (
        <button type="button" className="btn btn-muted" onClick={logout}>
          Logout
        </button>
      ) : null}
    </header>
  );
}
