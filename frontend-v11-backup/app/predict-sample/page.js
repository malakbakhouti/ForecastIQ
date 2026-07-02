"use client";

// app/predict-sample/page.js
// Permet à l'utilisateur d'uploader un échantillon de NOUVELLES données
// et d'obtenir des prédictions à partir d'un modèle déjà entraîné sur un dataset existant.

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const COLORS = {
  green: "#16a34a",
  blue: "#2563eb",
  red: "#dc2626",
  orange: "#f59e0b",
  border: "#e5e7eb",
  subtle: "#6b7280",
};

function fmtK(n) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

function errorColor(pct) {
  if (pct === null || pct === undefined) return COLORS.subtle;
  const abs = Math.abs(pct);
  if (abs < 10) return COLORS.green;
  if (abs < 25) return COLORS.orange;
  return COLORS.red;
}

function PredictSampleContent() {
  const router = useRouter();
  const fileRef = useRef(null);

  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [granularity, setGranularity] = useState("monthly");

  const [file, setFile] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.listDatasets().then(setDatasets).catch(console.error);
  }, []);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      setError("Format non supporté (CSV ou Excel uniquement)");
      return;
    }
    setError("");
    setFile(f);
    setResult(null);
  }

  async function handlePredict() {
    if (!selectedDataset || !file) {
      setError("Sélectionnez un modèle (dataset) et un fichier échantillon");
      return;
    }
    setPredicting(true);
    setError("");
    setResult(null);
    try {
      const res = await api.predictSample(selectedDataset, file, granularity);
      setResult(res);
    } catch (e) {
      setError(e.message || "Erreur lors de la prédiction");
    } finally {
      setPredicting(false);
    }
  }

  const comparisonChart = result?.comparison?.map(c => ({
    period: c.period,
    actual: c.actual,
    predicted: c.predicted,
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">
              F
            </div>
            <span className="text-lg font-bold">
              Forecast<span className="text-emerald-600">IQ</span>
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <button onClick={() => router.push("/dashboard")} className="text-gray-600 hover:text-gray-900">
              Tableau de bord
            </button>
            <button onClick={() => router.push("/upload")} className="text-gray-600 hover:text-gray-900">
              Importer
            </button>
            <span className="text-emerald-700 font-medium">Prédiction d'échantillon</span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Titre + explication */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Prédiction d'échantillon de nouvelles données
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Importez un échantillon de ventes récentes. L'application applique
            le meilleur modèle entraîné sur le dataset choisi et compare les
            prédictions aux valeurs réelles de l'échantillon.
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                1. Modèle (dataset entraîné)
              </label>
              <select
                value={selectedDataset || ""}
                onChange={(e) => setSelectedDataset(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">— Sélectionner —</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.original_filename}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                2. Granularité
              </label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="daily">Journalière</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                3. Fichier échantillon (CSV/Excel)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile}
                className="w-full text-sm"
              />
              {file && (
                <p className="text-xs text-gray-500 mt-1">
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </div>
          </div>

          {selectedDataset && (
            <div className="mt-4 p-3 rounded bg-blue-50 border border-blue-200 text-xs text-blue-900">
              <strong>Important :</strong> votre fichier échantillon doit
              contenir les <strong>mêmes colonnes</strong> (date + valeur) que
              le dataset d'origine.
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handlePredict}
              disabled={!selectedDataset || !file || predicting}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {predicting ? "Prédiction en cours..." : "Lancer la prédiction"}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        {/* Résultats */}
        {result && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="text-xs text-gray-500">Modèle utilisé</div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {result.model_used.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Précision modèle :{" "}
                  <span className="font-semibold text-emerald-700">
                    {result.model_used.accuracy_pct?.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="text-xs text-gray-500">Périodes prédites</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {result.sample_size}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Granularité : {result.granularity}
                </div>
              </div>

              <div className="bg-white rounded-lg border-2 border-emerald-300 p-5">
                <div className="text-xs text-gray-500">Précision sur l'échantillon</div>
                <div
                  className="text-2xl font-bold mt-1"
                  style={{
                    color:
                      result.sample_accuracy_pct >= 70
                        ? COLORS.green
                        : COLORS.red,
                  }}
                >
                  {result.sample_accuracy_pct !== null
                    ? `${result.sample_accuracy_pct.toFixed(2)}%`
                    : "—"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  MAPE : {result.sample_mape?.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Graphique comparaison */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900">
                Comparaison : ventes réelles (échantillon) vs prédictions (modèle)
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Modèle : {result.model_used.name} — Précision globale :{" "}
                {result.model_used.accuracy_pct?.toFixed(2)}%
              </p>

              <div className="h-72 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparisonChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: COLORS.subtle }} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: COLORS.subtle }} />
                    <Tooltip formatter={(v) => fmtK(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="actual" name="Réel (échantillon)" fill={COLORS.green} radius={[3, 3, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Prédiction modèle"
                      stroke={COLORS.blue}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: COLORS.blue }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tableau détaillé */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900">
                Détail période par période
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Écart en % entre la valeur réelle de l'échantillon et la prédiction du modèle
              </p>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 pr-4 font-medium text-gray-600">Période</th>
                      <th className="py-2 pr-4 font-medium text-gray-600">Réel</th>
                      <th className="py-2 pr-4 font-medium text-gray-600">Prédit</th>
                      <th className="py-2 pr-4 font-medium text-gray-600">Écart %</th>
                      <th className="py-2 pr-4 font-medium text-gray-600">Précision %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison.map((c, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2.5 pr-4 text-gray-900">{c.period}</td>
                        <td className="py-2.5 pr-4 font-semibold text-emerald-700">
                          {fmtK(c.actual)}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-700">
                          {fmtK(c.predicted)}
                        </td>
                        <td
                          className="py-2.5 pr-4 font-semibold"
                          style={{ color: errorColor(c.error_pct) }}
                        >
                          {c.error_pct !== null
                            ? `${c.error_pct >= 0 ? "+" : ""}${c.error_pct.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-semibold"
                            style={{ color: c.accuracy_pct >= 70 ? COLORS.green : COLORS.red }}
                        >
                          {c.accuracy_pct !== null
                            ? `${c.accuracy_pct.toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function PredictSamplePage() {
  return (
    <AuthGuard>
      <PredictSampleContent />
    </AuthGuard>
  );
}
