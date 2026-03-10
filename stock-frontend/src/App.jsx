import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Growth from "./pages/Growth";
import MLAnalysis from "./pages/MLAnalysis";
import GoldSilver from "./pages/GoldSilver";
import Bitcoin from "./pages/Bitcoin";
import Compare from "./pages/Compare";
import "./index.css";

function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem("portfolio_user") === "true";
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/growth"
          element={
            <ProtectedRoute>
              <Growth />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ml-analysis"
          element={
            <ProtectedRoute>
              <MLAnalysis />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gold-silver"
          element={
            <ProtectedRoute>
              <GoldSilver />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bitcoin"
          element={
            <ProtectedRoute>
              <Bitcoin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compare"
          element={
            <ProtectedRoute>
              <Compare />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
