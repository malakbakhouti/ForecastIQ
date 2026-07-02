"use client";

// app/dashboard/page.js — Tableau de bord complet ForecastIQ

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import {
  OverviewTab, ForecastTab, AnomaliesTab, CategoriesTab, ModelsTab, fmtK,
} from "@/components/DashboardTabs";

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "models", label: "Modèles ML" },
  { key: "forecast", label: "Prévisions" },
  { key: "anomalies", label: "Anomalies" },
  { key: "categories", label: "Catégories" },
];

function DashboardContent() {
  const searchParams = useSearchParams();

  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paramètres de calcul
  const [granularity, setGranularity] = useState("monthly");
  const [horizon, setHorizon] = useState(6);
  const [category, setCategory] = useState("");

  // 1. Charger la liste des datasets
  useEffect(() => {
    api
      .listDatasets()
      .then((data) => {
        setDatasets(data.datasets);
        const urlDataset = searchParams.get("dataset");
        if (urlDataset && data.datasets.some((d) => d.id === Number(urlDataset))) {
          setSelectedId(Number(urlDataset));
        } else if (data.datasets.length > 0) {
          setSelectedId(data.datasets[0].id); // le plus récent
        } else {
          setLoading(false);
        }
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [searchParams]);

  // 2. Charger le dashboard du dataset sélectionné
  const loadDashboard = useCallback(() => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    api
      .getDashboard(selectedId, { granularity, horizon, category: category || undefined })
      .then((data) => {
        // injecter le rapport de nettoyage dans result pour l'onglet Overview
        data.result._cleaning = data.cleaning_report;
        setDashboard(data);
        if (!category && data.active_category) {
          setCategory(data.active_category);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedId, granularity, horizon, category]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ----- Cas : aucun dataset -----
  if (!loading && datasets.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-xl border border-gray-200 p-10">
          <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-600 text-2xl font-bold">+</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Aucune donnée importée
          </h2>
          <p className="text-gray-600 mt-2">
            Importez votre premier fichier de ventes pour générer des prévisions.
          </p>
          <Link
            href="/upload"
            className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            Importer des données
          </Link>
        </div>
      </div>
    );
  }

  const result = dashboard?.result;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* En-tête */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Tableau de bord — prévision des ventes
          </h1>
          {dashboard && (
            <p className="text-xs text-gray-500 mt-1">
              {dashboard.dataset.name} — {dashboard.dataset.row_count?.toLocaleString("fr-FR")} lignes
            </p>
          )}
        </div>
      </div>

      {/* Barre de contrôles */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Sélecteur de dataset */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Jeu de données</label>
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Granularité */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Granularité</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              <option value="monthly">Mensuelle</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="daily">Journalière</option>
            </select>
          </div>

          {/* Horizon */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Horizon ({horizon} période{horizon > 1 ? "s" : ""})
            </label>
            <input
              type="range"
              min="1"
              max="24"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-40 accent-emerald-600"
            />
          </div>

          {/* Catégorie */}
          {dashboard?.available_categories?.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                {dashboard.available_categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading || !result ? (
        <div className="bg-white rounded-lg border border-gray-200 p-20 text-center text-gray-500 text-sm">
          Calcul des prévisions en cours...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
              <Kpi label="Total ventes" value={fmtK(result.stats.total)} />
              <Kpi label="Moyenne" value={fmtK(result.stats.mean)} />
              <Kpi
                label="Croissance"
                value={(result.stats.growth_percent > 0 ? "+" : "") + result.stats.growth_percent + "%"}
                color="#16a34a"
              />
              <Kpi label="Pic maximum" value={fmtK(result.stats.max)} />
              <Kpi label="Anomalies" value={result.anomalies.length} color="#ef4444" />
              <Kpi
                label="Prévision P+1"
                value={fmtK(result.ensemble.forecast[0])}
                color="#2563eb"
              />
            </div>
          </div>

          {/* Onglets */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-6 -mb-px overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-1 py-3 text-sm border-b-2 whitespace-nowrap transition-colors ${
                    tab === t.key
                      ? "border-gray-900 text-gray-900 font-semibold"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {tab === "overview" && <OverviewTab result={result} />}
          {tab === "forecast" && <ForecastTab result={result} />}
          {tab === "anomalies" && <AnomaliesTab result={result} />}
          {tab === "categories" && <CategoriesTab result={result} />}
          {tab === "models" && <ModelsTab result={result} />}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color = "#111827" }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-2xl font-semibold tracking-tight" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="p-20 text-center text-gray-500">Chargement...</div>}>
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  );
}
