"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const programs = new Set(["run-club", "strength", "recovery", "not-sure"]);
const programOptions = [
  { value: "not-sure", label: "I’m open to suggestions" },
  { value: "run-club", label: "Run club" },
  { value: "strength", label: "Strength" },
  { value: "recovery", label: "Recovery" },
];

function ProgramSelect({ selectedProgram }: { selectedProgram: string }) {
  return (
    <select defaultValue={selectedProgram} name="program" required>
      {programOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ProgramSelectFromSearch() {
  const requestedProgram = useSearchParams().get("program");
  const selectedProgram = requestedProgram && programs.has(requestedProgram)
    ? requestedProgram
    : "not-sure";

  return <ProgramSelect selectedProgram={selectedProgram} />;
}

type SubmissionState =
  | { kind: "idle" }
  | { kind: "error"; message: string };

export default function JoinForm() {
  const router = useRouter();
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmission({ kind: "idle" });
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const result: { message?: string; error?: string } = await response.json();

      if (!response.ok) {
        setSubmission({
          kind: "error",
          message: result.error ?? "We couldn’t send your request. Please try again.",
        });
        return;
      }

      router.push("/join/confirmation");
    } catch {
      setSubmission({
        kind: "error",
        message: "We couldn’t reach the server. Check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="join-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>YOUR NAME</span>
        <input
          autoComplete="name"
          maxLength={100}
          minLength={2}
          name="name"
          placeholder="How should we call you?"
          required
        />
      </label>
      <label className="form-field">
        <span>EMAIL ADDRESS</span>
        <input
          autoComplete="email"
          maxLength={254}
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>
      <label className="form-field">
        <span>PHONE <span className="field-optional">(OPTIONAL)</span></span>
        <input
          autoComplete="tel"
          maxLength={40}
          name="phone"
          placeholder="A number we can reach you on"
          type="tel"
        />
      </label>
      <label className="form-field">
        <span>WHAT ARE YOU INTO?</span>
        <Suspense fallback={<ProgramSelect selectedProgram="not-sure" />}>
          <ProgramSelectFromSearch />
        </Suspense>
      </label>
      <button className="button button-dark join-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending..." : "Find my first session"}
        <span aria-hidden="true">{isSubmitting ? "…" : "↗"}</span>
      </button>
      <p
        aria-live="polite"
        className={`form-feedback${submission.kind === "error" ? " form-feedback-error" : ""}`}
        role={submission.kind === "error" ? "alert" : "status"}
      >
        {submission.kind === "idle" ? "We’ll only use your details to get back to you." : submission.message}
      </p>
    </form>
  );
}
