import type { Metadata } from "next";
import "./crm.css";
export const metadata: Metadata = {
  title: "Catering CRM",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="crm-root">{children}</div>;
}
