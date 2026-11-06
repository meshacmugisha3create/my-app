"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "login" | "register";

function LoginFormContent({ initialMode, initialError }: { initialMode: Mode; initialError: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData);

    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: { error?: string } = await response.json();

      if (!response.ok) {
        setError(result.error ?? "We couldn’t sign you in. Please try again.");
        return;
      }

      router.replace("/progress");
      router.refresh();
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-wrap">
      <div className="auth-mode" role="tablist" aria-label="Account access">
        <button
          aria-selected={mode === "login"}
          onClick={() => { setMode("login"); setError(""); }}
          role="tab"
          type="button"
        >
          Sign in
        </button>
        <button
          aria-selected={mode === "register"}
          onClick={() => { setMode("register"); setError(""); }}
          role="tab"
          type="button"
        >
          Create account
        </button>
      </div>
      <form className="join-form" onSubmit={handleSubmit}>
        {mode === "register" && (
          <label className="form-field">
            <span>YOUR NAME</span>
            <input autoComplete="name" maxLength={100} minLength={2} name="name" required />
          </label>
        )}
        <label className="form-field">
          <span>EMAIL ADDRESS</span>
          <input autoComplete="email" maxLength={254} name="email" required type="email" />
        </label>
        <label className="form-field">
          <span>PASSWORD</span>
          <input
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            maxLength={128}
            minLength={mode === "register" ? 8 : undefined}
            name="password"
            required
            type="password"
          />
        </label>
        <button className="button button-dark join-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
          <span aria-hidden="true">↗</span>
        </button>
        <p aria-live="polite" className={`form-feedback${error ? " form-feedback-error" : ""}`} role={error ? "alert" : "status"}>
          {error || (mode === "register" ? "Use at least 8 characters for your password." : "Your progress is private to your account.")}
        </p>
      </form>
      <div className="auth-divider"><span>OR</span></div>
      <a className="google-login" href="/api/auth/google">
        <span className="google-mark" aria-hidden="true">G</span>
        Continue with Google
      </a>
    </div>
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const googleError = searchParams.get("error");
  const errorMessages: Record<string, string> = {
    google_unconfigured: "Google sign-in is not configured yet. Add the Google OAuth values to .env.local.",
    google_cancelled: "Google sign-in was cancelled.",
    google_email_unverified: "Use a Google account with a verified email address to continue.",
    google_link_signin: "Sign in to your Mesh account before connecting Google.",
    google_link_required: "An account with this email already exists. Sign in, then connect Google from your dashboard.",
    google_account_mismatch: "Connect the Google account that uses your Mesh account email.",
    google_failed: "Google sign-in couldn’t be completed. Please try again.",
  };
  const initialError = googleError ? errorMessages[googleError] ?? "Google sign-in couldn’t be completed." : "";

  return <LoginFormContent key={`${initialMode}:${googleError ?? ""}`} initialMode={initialMode} initialError={initialError} />;
}