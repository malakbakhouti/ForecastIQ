"use client";

// app/admin/page.js — Module d'administration (rôle admin uniquement)

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { API_BASE, getToken } from "@/lib/api";

// Petit helper de requête authentifiée (les endpoints admin ne sont pas dans api.js)
async function adminRequest(path, { method = "GET", body } = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
  return data;
}

const ROLE_LABELS = { user: "Utilisateur", manager: "Manager", admin: "Administrateur" };
const ROLE_COLORS = {
  user: "bg-blue-100 text-blue-700",
  manager: "bg-amber-100 text-amber-700",
  admin: "bg-purple-100 text-purple-700",
};

function AdminContent() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Formulaire de création d'utilisateur
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "", email: "", password: "", role: "user",
  });
  const [creating, setCreating] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      adminRequest("/api/admin/users"),
      adminRequest("/api/admin/logs?limit=50"),
      adminRequest("/api/admin/stats"),
    ])
      .then(([u, l, s]) => {
        setUsers(u.users);
        setLogs(l.logs);
        setStats(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await adminRequest("/api/admin/users", {
        method: "POST",
        body: newUser,
      });
      setShowCreate(false);
      setNewUser({ full_name: "", email: "", password: "", role: "user" });
      loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(userId, newRole) {
    setError("");
    try {
      await adminRequest(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        body: { role: newRole },
      });
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleStatus(user) {
    setError("");
    try {
      await adminRequest(`/api/admin/users/${user.id}/status`, {
        method: "PUT",
        body: { is_active: !user.is_active },
      });
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteUser(userId) {
    if (!confirm("Supprimer définitivement cet utilisateur ?")) return;
    setError("");
    try {
      await adminRequest(`/api/admin/users/${userId}`, { method: "DELETE" });
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Administration</h1>
      <p className="text-gray-600 mb-6">
        Gestion des utilisateurs, des rôles et supervision du système.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Utilisateurs" value={stats.users.total} />
          <StatCard label="Comptes actifs" value={stats.users.active} />
          <StatCard label="Datasets importés" value={stats.datasets} />
          <StatCard label="Prévisions générées" value={stats.forecasts} />
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6 -mb-px">
          <button
            onClick={() => setTab("users")}
            className={`px-1 py-3 text-sm border-b-2 transition-colors ${
              tab === "users"
                ? "border-gray-900 text-gray-900 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Utilisateurs
          </button>
          <button
            onClick={() => setTab("logs")}
            className={`px-1 py-3 text-sm border-b-2 transition-colors ${
              tab === "logs"
                ? "border-gray-900 text-gray-900 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Journal d'activité
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500 text-sm">
          Chargement...
        </div>
      ) : tab === "users" ? (
        <div>
          {/* Bouton + formulaire de création */}
          <div className="mb-4">
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              >
                + Ajouter un utilisateur
              </button>
            ) : (
              <form
                onSubmit={createUser}
                className="bg-white rounded-lg border border-gray-200 p-5"
              >
                <h3 className="font-semibold text-gray-900 mb-4">
                  Nouvel utilisateur
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      required
                      value={newUser.full_name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, full_name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      placeholder="8+ car., 1 maj., 1 min., 1 chiffre"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Rôle
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({ ...newUser, role: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="user">Utilisateur</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {creating ? "Création..." : "Créer le compte"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left bg-gray-50">
                <th className="py-3 px-4 font-medium text-gray-600">Utilisateur</th>
                <th className="py-3 px-4 font-medium text-gray-600">Email</th>
                <th className="py-3 px-4 font-medium text-gray-600">Rôle</th>
                <th className="py-3 px-4 font-medium text-gray-600">Statut</th>
                <th className="py-3 px-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{u.full_name}</td>
                  <td className="py-3 px-4 text-gray-600">{u.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${
                        ROLE_COLORS[u.role]
                      }`}
                    >
                      <option value="user">Utilisateur</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        u.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {u.is_active ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleStatus(u)}
                        className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                      >
                        {u.is_active ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left bg-gray-50">
                <th className="py-3 px-4 font-medium text-gray-600">Date</th>
                <th className="py-3 px-4 font-medium text-gray-600">Utilisateur</th>
                <th className="py-3 px-4 font-medium text-gray-600">Action</th>
                <th className="py-3 px-4 font-medium text-gray-600">Statut</th>
                <th className="py-3 px-4 font-medium text-gray-600">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50">
                  <td className="py-2.5 px-4 text-gray-500 text-xs">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString("fr-FR")
                      : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-gray-700">
                    {log.user_email || "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`text-xs ${
                        log.status === "success" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-500 text-xs">
                    {log.ip_address || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <AdminContent />
    </AuthGuard>
  );
}
