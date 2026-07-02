"use client";

// app/page.js — Landing page ForecastIQ
// Présentation de l'application pour les visiteurs non connectés.

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

// ---- Données de présentation ----
const FEATURES = [
  {
    title: "Importation universelle",
    desc: "Importez n'importe quel fichier CSV ou Excel. Le système détecte automatiquement les colonnes de dates, de valeurs et de catégories.",
  },
  {
    title: "Prévision multi-modèles",
    desc: "Quatre algorithmes de Machine Learning analysent vos données : régression linéaire, polynomiale, Random Forest et ARIMA.",
  },
  {
    title: "Détection d'anomalies",
    desc: "La méthode Z-score identifie automatiquement les périodes anormales dans votre historique de ventes.",
  },
  {
    title: "Tableaux de bord interactifs",
    desc: "Visualisez vos tendances, vos prévisions et vos indicateurs clés à travers des graphiques dynamiques.",
  },
  {
    title: "Analyse par segment",
    desc: "Ventilez vos ventes par segment, catégorie ou région pour comprendre la performance de chaque secteur.",
  },
  {
    title: "Sécurité et rôles",
    desc: "Authentification JWT, mots de passe chiffrés et gestion fine des accès selon le profil de chaque utilisateur.",
  },
];

const ACTORS = [
  {
    role: "Utilisateur",
    color: "bg-blue-50 border-blue-200 text-blue-700",
    desc: "Importe ses données, consulte son tableau de bord, lance des prévisions et exporte des rapports.",
  },
  {
    role: "Manager",
    color: "bg-amber-50 border-amber-200 text-amber-700",
    desc: "Consulte les résultats finaux et télécharge les rapports en lecture seule, sans toucher aux données brutes.",
  },
  {
    role: "Administrateur",
    color: "bg-purple-50 border-purple-200 text-purple-700",
    desc: "Gère les comptes, les rôles et surveille le système, en plus de toutes les fonctions utilisateur.",
  },
  {
    role: "Système IA",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    desc: "Acteur automatique : lit, nettoie, calcule et stocke les prévisions sans intervention humaine.",
  },
];

const STEPS = [
  { num: "1", title: "Importez", desc: "Téléversez votre fichier de ventes au format CSV ou Excel." },
  { num: "2", title: "Analysez", desc: "Le système nettoie les données et détecte la structure automatiquement." },
  { num: "3", title: "Prévoyez", desc: "Les modèles de Machine Learning génèrent les prévisions futures." },
  { num: "4", title: "Décidez", desc: "Consultez le tableau de bord et exportez vos rapports d'aide à la décision." },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Si déjà connecté, rediriger vers le dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [loading, user, router]);

  return (
    <div className="bg-white">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 to-white" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium mb-6">
              Intelligence artificielle au service des entreprises
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Anticipez vos ventes avec{" "}
              <span className="text-emerald-600">ForecastIQ</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              Une application web intelligente qui transforme vos données historiques
              en prévisions fiables. Importez vos ventes, laissez le Machine Learning
              analyser les tendances, et prenez de meilleures décisions stratégiques.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                Commencer gratuitement
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATISTIQUES ===== */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-emerald-600">4</div>
              <div className="text-sm text-gray-600 mt-1">Modèles de prévision</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-600">CSV / Excel</div>
              <div className="text-sm text-gray-600 mt-1">Formats supportés</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-600">Auto</div>
              <div className="text-sm text-gray-600 mt-1">Détection des colonnes</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-600">JWT</div>
              <div className="text-sm text-gray-600 mt-1">Sécurité des accès</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FONCTIONNALITÉS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900">
            Une plateforme complète
          </h2>
          <p className="mt-3 text-gray-600">
            De l'importation des données à la décision stratégique, ForecastIQ
            couvre l'ensemble du cycle de la prévision des ventes.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="border border-gray-200 rounded-xl p-6 hover:border-emerald-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
                <span className="text-emerald-600 font-bold">+</span>
              </div>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== COMMENT ÇA MARCHE ===== */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900">Comment ça marche</h2>
            <p className="mt-3 text-gray-600">
              Quatre étapes simples pour passer de vos données brutes à des
              prévisions exploitables.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.num} className="relative">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg mb-4">
                  {s.num}
                </div>
                <h3 className="font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LES 4 ACTEURS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900">Pensé pour chaque profil</h2>
          <p className="mt-3 text-gray-600">
            ForecastIQ s'adapte aux besoins de chaque acteur de l'entreprise,
            avec des accès et des fonctionnalités spécifiques.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ACTORS.map((a) => (
            <div
              key={a.role}
              className={`border rounded-xl p-6 ${a.color}`}
            >
              <h3 className="font-semibold text-lg">{a.role}</h3>
              <p className="mt-3 text-sm leading-relaxed opacity-90">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="bg-emerald-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white">
            Prêt à anticiper vos ventes ?
          </h2>
          <p className="mt-3 text-emerald-50">
            Créez votre compte et importez vos premières données en quelques minutes.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-block px-8 py-3 rounded-lg bg-white text-emerald-700 font-medium hover:bg-emerald-50 transition-colors"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">F</span>
              </div>
              <span className="font-semibold text-gray-900">
                Forecast<span className="text-emerald-600">IQ</span>
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Projet de Fin d'Année — EMSI Rabat 2025/2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
