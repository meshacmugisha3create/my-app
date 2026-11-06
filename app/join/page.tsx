import type { Metadata } from "next";
import Link from "next/link";
import JoinForm from "./join-form";

export const metadata: Metadata = {
  title: "Join Mesh Sports",
  description: "Tell us what you’re interested in and find your first Mesh Sports session.",
};

export default function JoinPage() {
  return (
    <main className="join-page">
      <Link className="join-back-link" href="/">
        <span aria-hidden="true">←</span> BACK TO MESH
      </Link>
      <section className="join-panel" aria-labelledby="join-title">
        <div className="join-heading">
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1 id="join-title">
            Come as
            <br />
            <span>you are.</span>
          </h1>
          <p>
            Tell us a little about yourself. We’ll help you find a session that
            feels right.
          </p>
        </div>
        <JoinForm />
      </section>
      <p className="join-footnote">EVERY LEVEL. EVERY STORY. THAT’S THE POINT.</p>
    </main>
  );
}
