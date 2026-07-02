"use client";

// app/upload/page.js — Import de fichier CSV/Excel avec détection automatique

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

function UploadContent() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [datasetId, setDatasetId] = useState(null);

  const [dateCol, setDateCol] = useState("");
  const [valueCol, setValueCol] = useState("");
  const [categoryCols, setCategoryCols] = useState([]);
  const [savingMapping, setSavingMapping] = useState(false);

  function handleFileSelect(selected) {
    if (!selected) return;
    const ext = selected.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      setError("Format non supporté. Utilisez un fichier CSV ou Excel.");
      return;
    }
    setError("");
    setFile(selected);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await api.uploadDataset(file);
      setAnalysis(res.analysis);
      setDatasetId(res.dataset.id);
      setDateCol(res.analysis.detected.date_column || "");
      setValueCol(res.analysis.detected.value_column || "");
      setCategoryCols(res.analysis.detected.category_columns || []);
    } catch (err) {
      setError(err.message || "Échec de l'import");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    setSavingMapping(true);
    setError("");
    try {
      await api.updateMapping(datasetId, {
        date_column: dateCol,
        value_column: valueCol,
        category_columns: categoryCols,
      });
      router.push(`/dashboard?dataset=${datasetId}`);
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer le mapping");
      setSavingMapping(false);
    }
  }

  function toggleCategory(col) {
    setCategoryCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  // ===== ÉTAPE 2 : confirmation du mapping =====
  if (analysis) {
    const d = analysis.detected;
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Vérifiez la structure détectée
          </h1>
          <p className="text-gray-600 mt-1">
            Le système a analysé votre fichier. Confirmez ou corrigez le mapping
            des colonnes avant de générer les prévisions.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {analysis.row_count.toLocaleString("fr-FR")}
              </div>
              <div className="text-xs text-gray-500">Lignes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {analysis.column_count}
              </div>
              <div className="text-xs text-gray-500">Colonnes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">
                {d.category_columns.length}
              </div>
              <div className="text-xs text-gray-500">Catégories détectées</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Mapping des colonnes</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colonne de date
              {d.date_confidence >= 0.8 && (
                <span className="ml-2 text-xs text-emerald-600">
                  détectée automatiquement
                </span>
              )}
            </label>
            <select
              value={dateCol}
              onChange={(e) => setDateCol(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Sélectionner —</option>
              {analysis.columns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colonne de valeur à prévoir
              {d.value_confidence >= 0.8 && (
                <span className="ml-2 text-xs text-emerald-600">
                  détectée automatiquement
                </span>
              )}
            </label>
            <select
              value={valueCol}
              onChange={(e) => setValueCol(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Sélectionner —</option>
              {analysis.columns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colonnes de catégorie (pour la ventilation)
            </label>
            <div className="flex flex-wrap gap-2">
              {analysis.category_details.map((c) => (
                <button
                  key={c.column}
                  type="button"
                  onClick={() => toggleCategory(c.column)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    categoryCols.includes(c.column)
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  {c.column}
                  <span className="ml-1 text-xs opacity-60">
                    ({c.distinct_values})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Aperçu des données</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  {analysis.columns.slice(0, 7).map((c) => (
                    <th key={c} className="text-left py-2 pr-3 font-medium text-gray-600 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {analysis.columns.slice(0, 7).map((c) => (
                      <td key={c} className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                        {row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!dateCol || !valueCol || savingMapping}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {savingMapping ? "Préparation..." : "Confirmer et voir le tableau de bord"}
          </button>
          <button
            onClick={() => {
              setAnalysis(null);
              setFile(null);
            }}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Importer un autre fichier
          </button>
        </div>
      </div>
    );
  }

  // ===== ÉTAPE 1 : sélection du fichier =====
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importer des données</h1>
        <p className="text-gray-600 mt-1">
          Téléversez un fichier CSV ou Excel contenant votre historique de ventes.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-emerald-500 bg-emerald-50"
            : "border-gray-300 bg-white hover:border-emerald-300"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files[0])}
        />
        <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-emerald-600 text-2xl font-bold">+</span>
        </div>
        {file ? (
          <div>
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {(file.size / 1024).toFixed(0)} Ko — prêt à importer
            </p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-gray-900">
              Glissez votre fichier ici, ou cliquez pour parcourir
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Formats acceptés : CSV, XLSX, XLS
            </p>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-6 w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
      >
        {uploading ? "Analyse en cours..." : "Importer et analyser"}
      </button>

      <p className="mt-4 text-center text-xs text-gray-500">
        Le système détectera automatiquement les colonnes de date, de valeur et
        de catégorie.
      </p>
    </div>
  );
}

export default function UploadPage() {
  return (
    <AuthGuard roles={["user", "admin"]}>
      <UploadContent />
    </AuthGuard>
  );
}
