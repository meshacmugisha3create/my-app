import type { Metadata } from "next";
import StaffDashboard from "./staff-dashboard";

export const metadata: Metadata = {
  title: "Staff desk | Mesh Sports",
  description: "Manage upcoming Mesh sessions and member inquiries.",
};

export default function StaffPage() {
  return (
    <main className="member-page">
      <StaffDashboard />
    </main>
  );
}