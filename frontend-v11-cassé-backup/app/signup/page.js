"use client";

// app/signup/page.js — Page d'inscription

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

// Règles de mot de passe (identiques au backend auth.py)
function passwordChecks(pwd) {
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /\d/.test(pwd),
  };
}

export default function SignupPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checks = passwordChecks(password);
  const passwordValid = Object.values(checks).every(Boolean);
  const passwordsMatch = password === confirm && confirm.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!passwordValid) {
      setError("Le mot de passe ne respecte pas tous les critères");
      return;
    }
    if (!passwordsMatch) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password, fullName.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Inscription impossible");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
            <p className="text-sm text-gray-500 mt-1">
              Rejoignez ForecastIQ en quelques secondes
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Malak Bakhouti"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {/* Critères en temps réel */}
              {password.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <Criterion ok={checks.length} label="8 caractères min." />
                  <Criterion ok={checks.upper} label="Une majuscule" />
                  <Criterion ok={checks.lower} label="Une minuscule" />
                  <Criterion ok={checks.digit} label="Un chiffre" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {confirm.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-600">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "Création..." : "Créer mon compte"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-emerald-600 font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          ForecastIQ — EMSI Rabat 2025/2026
        </p>
      </div>
    </div>
  );
}

function Criterion({ ok, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
          ok ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400"
        }`}
      >
        {ok ? "✓" : ""}
      </span>
      <span className={ok ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </div>
  );
}
