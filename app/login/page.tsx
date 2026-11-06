import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Member login | Mesh Sports",
  description: "Sign in or create a Mesh Sports member account to track your progress.",
};

export default function LoginPage() {
  return (
    <main className="join-page">
      <Link className="join-back-link" href="/">
        <span aria-hidden="true">←</span> BACK TO MESH
      </Link>
      <section className="join-panel auth-panel" aria-labelledby="login-title">
        <div className="auth-heading">
          <p className="eyebrow">YOUR MOVEMENT, YOUR MOMENTUM</p>
          <h1 id="login-title">
            Make it
            <br />
            <span>count.</span>
          </h1>
          <p>Sign in to keep track of the work you put in and the progress you make.</p>
        </div>
        <Suspense fallback={<div className="auth-form-wrap" />}>
          <LoginForm />
        </Suspense>
      </section>
      <p className="join-footnote">EVERY LEVEL. EVERY STORY. THAT’S THE POINT.</p>
    </main>
  );
}