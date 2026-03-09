import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
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
        <Route path="/login" element={<Login />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
