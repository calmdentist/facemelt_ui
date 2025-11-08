import { Metadata } from "next";
import TokensTable from "@/components/TokenGrid";

export const metadata: Metadata = {
  title: "Facemelt",
  description: "View all tokens launched on Facemelt",
};

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">TOKENS</h1>
      <TokensTable />
    </div>
  );
} 