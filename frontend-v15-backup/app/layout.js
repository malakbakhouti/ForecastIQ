// app/layout.js — Layout racine de l'application ForecastIQ

import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "ForecastIQ — Prévision intelligente des ventes",
  description:
    "Application web intelligente de prévision des ventes pour les entreprises. "
    + "Importez vos données, analysez les tendances et anticipez vos ventes futures.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 antialiased">
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
