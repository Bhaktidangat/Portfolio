import { NavLink, useNavigate } from "react-router-dom";

const items = [
  { to: "/home", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/growth", label: "Growth" },
  { to: "/ml-analysis", label: "ML Analysis" },
  { to: "/gold-silver", label: "Gold Silver" },
  { to: "/bitcoin", label: "Bitcoin" },
  { to: "/compare", label: "Compare" },
];

export default function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("portfolio_user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("use_jwt_auth");
    navigate("/login", { replace: true });
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
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="btn btn-muted" onClick={logout}>
        Logout
      </button>
    </header>
  );
}
