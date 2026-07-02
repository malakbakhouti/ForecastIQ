"use client";

// components/DashboardTabs.js — Les 5 onglets du tableau de bord
// (Vue d'ensemble, Prévisions, Anomalies, Catégories, Modèles ML)

import React, { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, AreaChart, Area,
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceDot, ReferenceLine, Cell,
} from "recharts";

const COLORS = {
  green: "#16a34a",
  greenLight: "#dcfce7",
  blue: "#2563eb",
  movavg: "#8b5cf6",
  trend: "#f97316",
  red: "#ef4444",
  text: "#111827",
  subtle: "#6b7280",
  border: "#e5e7eb",
};

const MODEL_COLORS = {
  linear: "#2563eb",
  polynomial: "#f97316",
  random_forest: "#16a34a",
  arima: "#8b5cf6",
  ensemble: "#dc2626",
};

export const fmtK = (n) => {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
};

const fmtPct = (v) => (v > 0 ? "+" : "") + Number(v).toFixed(1) + "%";

// ============================================================
// ONGLET 1 — Vue d'ensemble
// ============================================================
export function OverviewTab({ result }) {
  const linear = result.models.find((m) => m.key === "linear");

  const chartData = useMemo(() => {
    const hist = result.series.map((s, i) => ({
      label: s.period,
      ventes: s.value,
      movingAverage: result.moving_average[i],
      trend: linear ? linear.fitted[i] : null,
    }));
    const fc = result.forecast_labels.map((label, i) => ({
      label,
      forecast: result.ensemble.forecast[i],
    }));
    return [...hist, ...fc];
  }, [result, linear]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Analyse des données — évolution des ventes, tendance et prévisions
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {result.stats.periods} périodes — granularité {result.granularity}
        </p>
        <div className="h-80 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: COLORS.subtle }}
                interval={Math.max(1, Math.floor(chartData.length / 12))}
              />
              <YAxis tick={{ fontSize: 11, fill: COLORS.subtle }} tickFormatter={fmtK} />
              <Tooltip formatter={(v) => fmtK(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="ventes" name="Ventes réelles"
                stroke={COLORS.green} fill={COLORS.greenLight} strokeWidth={2} />
              <Line type="monotone" dataKey="movingAverage" name="Moyenne mobile"
                stroke={COLORS.movavg} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="trend" name="Tendance linéaire"
                stroke={COLORS.trend} strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
              <Line type="monotone" dataKey="forecast" name="Prévision (ensemble)"
                stroke={COLORS.blue} strokeWidth={2} dot={{ r: 4, fill: COLORS.blue }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Statistiques descriptives
          </h3>
          <dl className="text-sm divide-y divide-gray-100">
            <StatRow k="Total" v={fmtK(result.stats.total)} />
            <StatRow k="Moyenne par période" v={fmtK(result.stats.mean)} />
            <StatRow k="Minimum" v={fmtK(result.stats.min)} />
            <StatRow k="Maximum" v={fmtK(result.stats.max)} />
            <StatRow k="Croissance" v={fmtPct(result.stats.growth_percent)} />
            <StatRow k="Périodes analysées" v={result.stats.periods} />
          </dl>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Nettoyage des données
          </h3>
          <dl className="text-sm divide-y divide-gray-100">
            <StatRow k="Lignes importées" v={result._cleaning?.rows_before ?? "—"} />
            <StatRow k="Doublons retirés" v={result._cleaning?.duplicates_removed ?? "—"} />
            <StatRow k="Dates invalides" v={result._cleaning?.invalid_dates_removed ?? "—"} />
            <StatRow k="Valeurs invalides" v={result._cleaning?.invalid_values_removed ?? "—"} />
            <StatRow k="Lignes exploitées" v={result._cleaning?.rows_after ?? "—"} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function StatRow({ k, v }) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-gray-600">{k}</dt>
      <dd className="font-medium text-gray-900">{v}</dd>
    </div>
  );
}

// ============================================================
// ONGLET 2 — Prévisions
// Le prof veut : (1) comparaison réel vs prédit pour les MÊMES périodes
// (le test set des 20%) avec écart en %, et (2) prévisions futures basées
// UNIQUEMENT sur les modèles fiables (≥70%).
// ============================================================
export function ForecastTab({ result }) {
  const validation = result.validation;
  const ensemble = result.ensemble;
  const allRejected = ensemble?.all_rejected;

  // Construire la comparaison réel vs prédit pour chaque modèle fiable, période par période
  let comparisonData = [];
  let reliableModels = [];

  if (validation && !validation.error && validation.test_labels) {
    const testLabels = validation.test_labels;
    const testValues = validation.test_values;
    reliableModels = Object.entries(validation.models)
      .filter(([_, m]) => m.is_reliable)
      .map(([key, m]) => ({
        key,
        name: {
          linear: "Régression linéaire",
          polynomial: "Régression polynomiale",
          random_forest: "Random Forest",
          arima: "ARIMA(1,1,1)",
        }[key] || key,
        accuracy: m.accuracy_pct,
        predictions: m.predictions || [],
      }));

    // Une ligne par période, avec réel + prédiction de chaque modèle fiable + écart %
    comparisonData = testLabels.map((label, i) => {
      const row = { label, real: testValues[i] };
      reliableModels.forEach((m) => {
        const pred = m.predictions[i];
        row[m.key] = pred;
        row[`${m.key}_ecart`] = pred != null && testValues[i] !== 0
          ? ((pred - testValues[i]) / testValues[i]) * 100
          : null;
      });
      return row;
    });
  }

  // Prévisions futures (ensemble fiable)
  const futureForecast = result.forecast_labels.map((label, i) => ({
    label,
    value: ensemble?.forecast?.[i],
  }));

  return (
    <div className="space-y-6">
      {/* ====== Alerte si aucun modèle fiable ====== */}
      {allRejected && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-base font-semibold text-red-900">
            Aucun modèle fiable
          </h3>
          <p className="text-sm text-red-700 mt-1">
            Tous les modèles ont une précision inférieure à 70% sur le test set.
            Les prévisions ne peuvent pas être affichées.
          </p>
        </div>
      )}

      {/* ====== Comparaison réel vs prédit (test set) ====== */}
      {comparisonData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Comparaison : ventes réelles vs prévisions
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Test set 20% — {comparisonData.length} périodes — modèles fiables uniquement (précision ≥ 70%)
          </p>

          {/* Graphique comparatif : barres réelles vs lignes prédites */}
          <div className="h-80 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.subtle }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: COLORS.subtle }} />
                <Tooltip formatter={(v) => fmtK(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="real" name="Ventes réelles" fill={COLORS.green} radius={[3, 3, 0, 0]} />
                {reliableModels.map((m) => (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={`${m.name} (${m.accuracy}%)`}
                    stroke={MODEL_COLORS[m.key]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Tableau détaillé période par période */}
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left bg-gray-50">
                  <th className="py-2.5 px-3 font-medium text-gray-700">Période</th>
                  <th className="py-2.5 px-3 font-medium text-gray-700">Réel</th>
                  {reliableModels.map((m) => (
                    <th key={m.key} className="py-2.5 px-3 font-medium text-gray-700" colSpan="2">
                      {m.name}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-gray-200 text-left bg-gray-50">
                  <th className="py-2 px-3"></th>
                  <th className="py-2 px-3"></th>
                  {reliableModels.map((m) => (
                    <React.Fragment key={m.key}>
                      <th className="py-2 px-3 font-normal text-xs text-gray-500">Prévu</th>
                      <th className="py-2 px-3 font-normal text-xs text-gray-500">Écart %</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row) => (
                  <tr key={row.label} className="border-b border-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{row.label}</td>
                    <td className="py-2.5 px-3 text-gray-900 font-semibold" style={{ color: COLORS.green }}>
                      {fmtK(row.real)}
                    </td>
                    {reliableModels.map((m) => {
                      const ecart = row[`${m.key}_ecart`];
                      const ecartAbs = ecart != null ? Math.abs(ecart) : null;
                      const ecartColor =
                        ecartAbs == null ? "#6b7280" :
                        ecartAbs < 10 ? "#16a34a" :
                        ecartAbs < 25 ? "#f59e0b" : "#dc2626";
                      return (
                        <React.Fragment key={m.key}>
                          <td className="py-2.5 px-3 text-gray-700">{fmtK(row[m.key])}</td>
                          <td className="py-2.5 px-3 font-medium" style={{ color: ecartColor }}>
                            {ecart != null
                              ? (ecart > 0 ? "+" : "") + ecart.toFixed(1) + "%"
                              : "—"}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====== Prévisions futures (modèles fiables uniquement) ====== */}
      {!allRejected && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Prévisions futures
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Ensemble pondéré
            {ensemble.reliable_models?.length > 0 && (
              <>
                {" "}({ensemble.reliable_models
                  .map(k => ({
                    linear: "Régression linéaire",
                    polynomial: "Polynomiale",
                    random_forest: "Random Forest",
                    arima: "ARIMA",
                  }[k] || k))
                  .join(" + ")})
              </>
            )} — horizon {result.horizon} périodes
          </p>

          {/* Graphique des prévisions */}
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={futureForecast} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.subtle }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: COLORS.subtle }} />
                <Tooltip
                  formatter={(v) => fmtK(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Bar dataKey="value" name="Prévision" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cartes des prévisions avec dates */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            {result.forecast_labels.map((label, i) => (
              <div
                key={label}
                className="bg-gray-50 rounded-lg border border-gray-200 p-4"
              >
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-2xl font-semibold mt-1" style={{ color: COLORS.blue }}>
                  {fmtK(ensemble.forecast[i])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ONGLET 3 — Anomalies
// ============================================================
export function AnomaliesTab({ result }) {
  const chartData = result.series.map((s) => ({
    label: s.period, sales: s.value,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Détection des anomalies
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Méthode Z-score, seuil 2σ —{" "}
          <span className="text-orange-600 font-medium">
            {result.anomalies.length} anomalie{result.anomalies.length > 1 ? "s" : ""} détectée
            {result.anomalies.length > 1 ? "s" : ""}
          </span>
        </p>
        <div className="h-80 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.subtle }}
                interval={Math.max(1, Math.floor(chartData.length / 12))} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: COLORS.subtle }} />
              <Tooltip formatter={(v) => fmtK(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Area type="monotone" dataKey="sales" name="Ventes"
                stroke={COLORS.green} fill={COLORS.greenLight} strokeWidth={2} />
              {result.anomalies.map((a) => (
                <ReferenceDot key={a.period} x={a.period} y={a.value}
                  r={6} fill={COLORS.red} stroke="#fff" strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Périodes anormales identifiées
        </h3>
        {result.anomalies.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune anomalie détectée.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {result.anomalies.map((a) => (
              <div key={a.period} className="flex justify-between items-center py-3">
                <div className="text-sm">
                  <span className="text-gray-600">Période : </span>
                  <span className="font-semibold">{a.period}</span>
                  <span className="ml-3 text-xs text-gray-500">z = {a.zscore}</span>
                </div>
                <div className="text-sm font-medium" style={{ color: COLORS.red }}>
                  {fmtK(a.value)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ONGLET 4 — Catégories
// ============================================================
export function CategoriesTab({ result }) {
  if (!result.category_breakdown) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500 text-sm">
        Aucune colonne de catégorie sélectionnée pour ce dataset.
      </div>
    );
  }

  const data = Object.entries(result.category_breakdown)
    .map(([name, v]) => ({ name, value: v.total, count: v.count }))
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((s, d) => s + d.value, 0);

  // Top et Flop — logique adaptative
  // - Si > 6 catégories : Top 5 + Flop 5
  // - Si 4-6 catégories : Top moitié + Flop moitié (sans chevauchement)
  // - Si 2-3 catégories : Top complet uniquement
  let topItems = [];
  let flopItems = [];
  if (data.length >= 7) {
    topItems = data.slice(0, 5);
    flopItems = data.slice(-5).reverse();
  } else if (data.length >= 4) {
    const half = Math.floor(data.length / 2);
    topItems = data.slice(0, half);
    flopItems = data.slice(-half).reverse();
  } else {
    topItems = data;
    flopItems = [];
  }

  return (
    <div className="space-y-6">
      {/* === TOP & FLOP — vue rapide pour décideurs === */}
      {data.length >= 2 && (
        <div className={`grid grid-cols-1 ${flopItems.length > 0 ? "lg:grid-cols-2" : ""} gap-6`}>
          {/* Top — Articles les plus vendus */}
          <div className="bg-white rounded-lg border border-emerald-200 p-5">
            <h3 className="text-base font-semibold text-gray-900">
              Top {topItems.length} — articles les plus vendus
            </h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Articles les plus demandés — à prioriser en stock et marketing
            </p>
            <div className="space-y-2">
              {topItems.map((d, i) => {
                const pct = total ? (d.value / total) * 100 : 0;
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{d.name}</span>
                        <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{fmtK(d.value)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{pct.toFixed(1)}% du total</span>
                        <span>{d.count} transactions</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flop — Articles les moins vendus */}
          {flopItems.length > 0 && (
            <div className="bg-white rounded-lg border border-red-200 p-5">
              <h3 className="text-base font-semibold text-gray-900">
                Flop {flopItems.length} — articles les moins vendus
              </h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Articles les moins demandés — à analyser ou réviser
              </p>
              <div className="space-y-2">
                {flopItems.map((d, i) => {
                  const pct = total ? (d.value / total) * 100 : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{d.name}</span>
                          <span className="text-sm font-bold text-red-700 flex-shrink-0">{fmtK(d.value)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{pct.toFixed(1)}% du total</span>
                          <span>{d.count} transactions</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === Graphique complet (toutes catégories) === */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Répartition complète des ventes par catégorie
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical"
              margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 11, fill: COLORS.subtle }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: COLORS.text }} width={110} />
              <Tooltip formatter={(v) => fmtK(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="value" fill={COLORS.green} radius={[0, 3, 3, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((d) => {
          const pct = total ? (d.value / total) * 100 : 0;
          return (
            <div key={d.name} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">{d.name}</div>
              <div className="text-2xl font-semibold mt-1">{fmtK(d.value)}</div>
              <div className="w-full h-1 bg-gray-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: COLORS.green }} />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {pct.toFixed(1)}% du total — {d.count} transactions
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ONGLET 5 — Modèles ML (comparaison des 4 algorithmes)
// ============================================================
export function ModelsTab({ result }) {
  // Graphe : prévisions des 4 modèles côte à côte
  const chartData = result.forecast_labels.map((label, i) => {
    const row = { label };
    result.models.forEach((m) => {
      row[m.key] = m.forecast[i];
    });
    row.ensemble = result.ensemble.forecast[i];
    return row;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Comparaison des modèles de prévision
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Régression linéaire — Polynomiale degré 2 — Random Forest — ARIMA(1,1,1) — Ensemble pondéré
        </p>
        <div className="h-80 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.subtle }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: COLORS.subtle }} />
              <Tooltip formatter={(v) => fmtK(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {result.models.map((m) => (
                <Line key={m.key} type="monotone" dataKey={m.key} name={m.name}
                  stroke={MODEL_COLORS[m.key]} strokeWidth={1.5} dot={{ r: 3 }} />
              ))}
              <Line type="monotone" dataKey="ensemble" name="Ensemble"
                stroke={MODEL_COLORS.ensemble} strokeWidth={2.5} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Métriques de qualité des modèles
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-4 font-medium text-gray-600">Modèle</th>
                <th className="py-2 pr-4 font-medium text-gray-600">R²</th>
                <th className="py-2 pr-4 font-medium text-gray-600">MAE</th>
                <th className="py-2 pr-4 font-medium text-gray-600">RMSE</th>
                <th className="py-2 pr-4 font-medium text-gray-600">Poids ensemble</th>
              </tr>
            </thead>
            <tbody>
              {result.models.map((m) => {
                const isBest = m.key === result.best_model;
                return (
                  <tr key={m.key} className="border-b border-gray-50">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-gray-900">{m.name}</span>
                      {isBest && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                          meilleur
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700">{m.metrics.r2 ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{fmtK(m.metrics.mae)}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{fmtK(m.metrics.rmse)}</td>
                    <td className="py-2.5 pr-4 text-gray-700">
                      {result.ensemble.weights[m.key] !== undefined
                        ? (result.ensemble.weights[m.key] * 100).toFixed(1) + "%"
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Le R² mesure la qualité de l'ajustement (plus proche de 1, meilleur).
          L'ensemble combine les modèles en pondérant par leur R².
        </p>
      </div>

      {/* ====== VALIDATION TRAIN / TEST (80% / 20%) ====== */}
      {result.validation && !result.validation.error && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Précision (accuracy) des modèles — validation train/test 80% / 20%
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Précision réelle des modèles sur des données jamais vues pendant
            l'entraînement —{" "}
            <span className="font-medium">{result.validation.n_train} périodes</span>{" "}
            pour entraîner,{" "}
            <span className="font-medium">{result.validation.n_test} périodes</span>{" "}
            pour tester. Seuil de fiabilité :{" "}
            <span className="font-medium">{result.validation.threshold_pct}%</span>
          </p>

          {/* COURBE/BARRES de précision par modèle */}
          <div className="h-64 mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Object.entries(result.validation.models)
                  .filter(([key, m]) => m.accuracy_pct !== null && m.accuracy_pct !== undefined)
                  .map(([key, m]) => ({
                    name: ({
                      linear: "Linéaire",
                      polynomial: "Polynomiale",
                      random_forest: "Random Forest",
                      arima: "ARIMA",
                    }[key] || key),
                    accuracy: m.accuracy_pct,
                    reliable: m.is_reliable,
                  }))}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: COLORS.subtle }} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: COLORS.subtle }}
                />
                <Tooltip
                  formatter={(v) => [`${v.toFixed(2)}%`, "Précision"]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <ReferenceLine
                  y={result.validation.threshold_pct}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  label={{
                    value: `Seuil ${result.validation.threshold_pct}%`,
                    position: "right",
                    fill: "#dc2626",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                  {Object.entries(result.validation.models)
                    .filter(([key, m]) => m.accuracy_pct !== null && m.accuracy_pct !== undefined)
                    .map(([key, m], i) => (
                      <Cell key={i} fill={m.is_reliable ? "#16a34a" : "#dc2626"} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 text-center -mt-2">
            Barres vertes = modèles fiables (≥ seuil) — Barres rouges = modèles rejetés (&lt; seuil)
          </p>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 pr-4 font-medium text-gray-600">Modèle</th>
                  <th className="py-2 pr-4 font-medium text-gray-600">Précision (%)</th>
                  <th className="py-2 pr-4 font-medium text-gray-600">MAPE</th>
                  <th className="py-2 pr-4 font-medium text-gray-600">MAE</th>
                  <th className="py-2 pr-4 font-medium text-gray-600">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.validation.models).map(([key, m]) => {
                  const modelName = {
                    linear: "Régression linéaire",
                    polynomial: "Régression polynomiale",
                    random_forest: "Random Forest",
                    arima: "ARIMA(1,1,1)",
                  }[key] || key;
                  const acc = m.accuracy_pct;
                  const reliable = m.is_reliable;
                  return (
                    <tr key={key} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">
                        {modelName}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="font-semibold"
                          style={{ color: reliable ? "#16a34a" : "#dc2626" }}
                        >
                          {acc !== null && acc !== undefined ? `${acc}%` : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">
                        {m.mape !== null && m.mape !== undefined ? `${m.mape}%` : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtK(m.mae)}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            reliable
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {reliable ? "✓ Fiable" : "✗ À rejeter"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Précision = 100% − MAPE. Seuil de fiabilité : 70%.
          </p>
        </div>
      )}
    </div>
  );
}
