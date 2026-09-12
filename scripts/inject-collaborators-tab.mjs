import { readFileSync, writeFileSync } from "node:fs";

const path = "src/routes/admin.tsx";
let source = readFileSync(path, "utf8");

const importMarker = 'import { SiteLayout } from "@/components/site/SiteLayout";';
if (!source.includes('from "@/components/admin/CollaboratorsTab"')) {
  if (!source.includes(importMarker)) throw new Error("Admin import marker not found");
  source = source.replace(
    importMarker,
    `${importMarker}\nimport { CollaboratorsTab } from "@/components/admin/CollaboratorsTab";`,
  );
}

const iconMarker = '  Store,\n} from "lucide-react";';
if (!source.includes("  Users,")) {
  if (!source.includes(iconMarker)) throw new Error("Lucide import marker not found");
  source = source.replace(iconMarker, '  Store,\n  Users,\n} from "lucide-react";');
}

const sellersTab = '  { id: "sellers", label: "Sellers", icon: Store },';
if (!source.includes('{ id: "collaborators", label: "Collaborators"')) {
  if (!source.includes(sellersTab)) throw new Error("Sellers tab marker not found");
  source = source.replace(
    sellersTab,
    `${sellersTab}\n  { id: "collaborators", label: "Collaborators", icon: Users },`,
  );
}

const sellersRender = '          {activeTab === "sellers" ? <SellersTab /> : null}';
if (!source.includes('activeTab === "collaborators"')) {
  if (!source.includes(sellersRender)) throw new Error("Sellers render marker not found");
  source = source.replace(
    sellersRender,
    `${sellersRender}\n          {activeTab === "collaborators" ? <CollaboratorsTab /> : null}`,
  );
}

writeFileSync(path, source);
console.log("Collaborators tab injected into admin.tsx");
