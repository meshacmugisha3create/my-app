import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Request received | Mesh Sports",
  description: "Your Mesh Sports session request has been received.",
};

export default function JoinConfirmationPage() {
  return (
    <main className="join-page">
      <Link className="join-back-link" href="/">
        <span aria-hidden="true">←</span> BACK TO MESH
      </Link>
      <section className="join-panel join-confirmation-panel" aria-labelledby="confirmation-title">
        <span className="confirmation-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">YOU’RE ON YOUR WAY</p>
        <h1 className="confirmation-title" id="confirmation-title">
          Your first session starts here.
        </h1>
        <p className="confirmation-copy">
          Thanks for reaching out. We’ve received your details and the Mesh team
          will be in touch soon to help find a session that fits.
        </p>
        <div className="confirmation-actions">
          <Link className="button button-dark" href="/">
            Back to Mesh <span aria-hidden="true">↗</span>
          </Link>
          <Link className="text-link" href="/join">
            Send another request <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <p className="join-footnote">EVERY LEVEL. EVERY STORY. THAT’S THE POINT.</p>
    </main>
  );
}