"use client";

// components/Navbar.js — Barre de navigation ForecastIQ

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

const ROLE_LABELS = {
  user: "Utilisateur",
  manager: "Manager",
  admin: "Administrateur",
};

const ROLE_COLORS = {
  user: "bg-blue-100 text-blue-700",
  manager: "bg-amber-100 text-amber-700",
  admin: "bg-purple-100 text-purple-700",
};

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  const navLinks = [];
  if (user) {
    navLinks.push({ href: "/dashboard", label: "Tableau de bord" });
    if (user.role === "user" || user.role === "admin") {
      navLinks.push({ href: "/upload", label: "Importer" });
    }
    if (user.role === "admin") {
      navLinks.push({ href: "/admin", label: "Administration" });
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-semibold text-lg text-gray-900">
              Forecast<span className="text-emerald-600">IQ</span>
            </span>
          </Link>

          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            {loading ? null : user ? (
              <>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm text-gray-700">{user.full_name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      ROLE_COLORS[user.role] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Se connecter
                </Link>
                <Link
                  href="/signup"
                  className="text-sm px-4 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Commencer
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
