import { useState } from "react";

import { Button } from "./ui/button";

// Banner de consentimiento RGPD. Persisto la decisión en localStorage para que
// el usuario no tenga que reaceptar en cada recarga.

export const COOKIE_CONSENT_STORAGE_KEY = "gym_manager_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return !stored;
  });

  // Funcion para aceptar las cookies
  const handleAccept = () => {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      new Date().toISOString(),
    );
    setVisible(false);
  };

  // Si el usuario ya ha aceptado las cookies, no se muestra el banner.
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-[#e0e2e6] bg-white p-4 shadow-[rgba(15,48,106,0.12)_0px_10px_30px] sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <p className="text-sm leading-relaxed text-[rgba(4,14,32,0.75)]">
          Usamos cookies estrictamente necesarias para mantener tu sesión
          iniciada de forma segura. No compartimos datos con terceros ni
          rastreamos tu actividad fuera de GymManager.
        </p>
        <div className="shrink-0 sm:ml-auto">
          <Button
            type="button"
            onClick={handleAccept}
            className="h-10 w-full px-5 sm:w-auto"
          >
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
