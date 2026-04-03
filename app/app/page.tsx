import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">HumanGate</h1>
      <p className="text-lg text-gray-400 max-w-md text-center">
        On-chain proof-of-humanity for AI agents, powered by World ID.
      </p>
      <div className="flex gap-4">
        <Link
          href="/widget"
          className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition"
        >
          Verify an Agent
        </Link>
        <Link
          href="/dashboard"
          className="px-6 py-3 border border-gray-700 rounded-lg font-medium hover:border-gray-500 transition"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
