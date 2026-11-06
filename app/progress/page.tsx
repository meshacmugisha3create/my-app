import type { Metadata } from "next";
import ProgressDashboard from "./progress-dashboard";

export const metadata: Metadata = {
  title: "My progress | Mesh Sports",
  description: "Log activities and follow your Mesh Sports progress.",
};

export default function ProgressPage() {
  return (
    <main className="member-page">
      <ProgressDashboard />
    </main>
  );
}