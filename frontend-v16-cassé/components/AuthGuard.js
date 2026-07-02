"use client";

// components/AuthGuard.js — Protège les pages privées.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

export default function AuthGuard({ children, roles }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (!user) return null;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="font-semibold text-red-800">Accès refusé</h2>
          <p className="text-sm text-red-700 mt-2">
            Cette page est réservée aux rôles : {roles.join(", ")}.
          </p>
          <p className="text-xs text-red-600 mt-1">Votre rôle actuel : {user.role}</p>
        </div>
      </div>
    );
  }

  return children;
}
