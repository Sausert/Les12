"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (mode === "register") {
      const email = String(form.get("email") ?? "").trim();
      if (email) body.email = email;
      body.locale = locale;
    }

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({ error: "invalid_input" }));
    setError(data.error ?? "invalid_input");
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <h1 className="font-display text-center text-3xl text-gold">{tc("appName")}</h1>
      <p className="mt-1 text-center text-ivory-dim italic">{tc("tagline")}</p>

      <form onSubmit={onSubmit} className="dossier mt-8 space-y-4 p-6">
        <h2 className="font-display text-lg">{t(mode === "login" ? "loginTitle" : "registerTitle")}</h2>

        <label className="block text-sm">
          {t("username")}
          <input
            name="username"
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            className="mt-1 w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold"
          />
        </label>

        {mode === "register" && (
          <label className="block text-sm">
            {t("email")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </label>
        )}

        <label className="block text-sm">
          {t("password")}
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="mt-1 w-full rounded border border-gold/30 bg-night px-3 py-2 text-ivory outline-none focus:border-gold"
          />
        </label>

        {error && (
          <p className="text-sm text-blood-bright">
            {t.has(`errors.${error}`) ? t(`errors.${error}`) : tc("error")}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-gold px-4 py-2.5 font-display text-night transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? tc("loading") : t(mode === "login" ? "loginButton" : "registerButton")}
        </button>

        {mode === "register" && <p className="text-xs text-ivory-dim">{t("walletNote")}</p>}
      </form>

      <p className="mt-6 text-center text-sm text-ivory-dim">
        {t(mode === "login" ? "noAccount" : "haveAccount")}{" "}
        <Link href={mode === "login" ? "/register" : "/login"} className="text-gold underline">
          {t(mode === "login" ? "registerLink" : "loginLink")}
        </Link>
      </p>
    </div>
  );
}
