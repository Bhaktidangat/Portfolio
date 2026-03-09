import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Portfolio Builder" },
  { to: "/growth", label: "Growth Insights" },
  { to: "/ml-analysis", label: "ML Insights" },
  { to: "/compare", label: "Stock Compare" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar card">
      <h3>Navigation</h3>
      <div className="sidebar-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
