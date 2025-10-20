import { useState } from "react";
import { ControllerPage } from "../controllers/ControllerPage";

type TabType = "clusters" | "poolers" | "backups" | "scheduledbackups";

interface TabConfig {
  id: TabType;
  label: string;
  crdKind: string;
}

const TABS: TabConfig[] = [
  { id: "clusters", label: "Clusters", crdKind: "Cluster" },
  { id: "poolers", label: "Poolers", crdKind: "Pooler" },
  { id: "backups", label: "Backups", crdKind: "Backup" },
  { id: "scheduledbackups", label: "Scheduled Backups", crdKind: "ScheduledBackup" },
];

export function CloudNativePGPage() {
  const [activeTab, setActiveTab] = useState<TabType>("clusters");

  const currentTab = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  return (
    <div className="space-y-6">
      {/* Tabs Header */}
      <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-1.5 inline-flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200
              ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <ControllerPage
        controllerId="cloudnativepg"
        defaultCRDKind={currentTab.crdKind}
        key={currentTab.id}
      />
    </div>
  );
}
