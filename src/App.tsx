import { useState } from "react";
import ClosetView from "./components/ClosetView";
import OutfitsView from "./components/OutfitsView";
import CategoriesView from "./components/CategoriesView";

type Tab = "closet" | "outfits" | "categories";

export default function App() {
  const [tab, setTab] = useState<Tab>("closet");

  const navClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-full transition-colors ${
      tab === t
        ? "bg-brand-600 text-white"
        : "text-gray-600 hover:text-brand-600"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand-600 tracking-tight">
            ✨ FlashCloset
          </h1>
          <nav className="flex gap-1 bg-gray-100 rounded-full p-1">
            <button className={navClass("closet")} onClick={() => setTab("closet")}>
              Closet
            </button>
            <button className={navClass("outfits")} onClick={() => setTab("outfits")}>
              Outfits
            </button>
            <button className={navClass("categories")} onClick={() => setTab("categories")}>
              Categories
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {tab === "closet" && <ClosetView />}
        {tab === "outfits" && <OutfitsView />}
        {tab === "categories" && <CategoriesView />}
      </main>
    </div>
  );
}
