import { useSettingsStore } from "../../lib/store";
import { Settings as SettingsIcon, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/Button";

export function Settings() {
  const settings = useSettingsStore();

  const handleResetToDefaults = () => {
    if (confirm("Are you sure you want to reset all settings to their default values?")) {
      settings.resetToDefaults();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                Settings
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your preferences and performance settings
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefaults}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Data Refresh Settings */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Data Refresh Intervals
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure how frequently data is refreshed (in milliseconds)
          </p>
          <div className="space-y-4">
            <SettingInput
              label="Pods"
              value={settings.refreshIntervals.pods}
              onChange={(value) => settings.updateRefreshInterval("pods", value)}
              min={1000}
              step={1000}
            />
            <SettingInput
              label="Deployments"
              value={settings.refreshIntervals.deployments}
              onChange={(value) => settings.updateRefreshInterval("deployments", value)}
              min={1000}
              step={1000}
            />
            <SettingInput
              label="Services"
              value={settings.refreshIntervals.services}
              onChange={(value) => settings.updateRefreshInterval("services", value)}
              min={1000}
              step={1000}
            />
            <SettingInput
              label="Nodes"
              value={settings.refreshIntervals.nodes}
              onChange={(value) => settings.updateRefreshInterval("nodes", value)}
              min={1000}
              step={1000}
            />
            <SettingInput
              label="Metrics"
              value={settings.refreshIntervals.metrics}
              onChange={(value) => settings.updateRefreshInterval("metrics", value)}
              min={1000}
              step={1000}
            />
            <SettingInput
              label="Cluster Data"
              value={settings.refreshIntervals.cluster}
              onChange={(value) => settings.updateRefreshInterval("cluster", value)}
              min={1000}
              step={1000}
            />
          </div>
        </div>

        {/* Metrics Settings */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Metrics Settings
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Control metrics collection and display
          </p>
          <div className="space-y-4">
            <SettingToggle
              label="Enable Metrics"
              description="Enable or disable metrics collection across the application"
              value={settings.metrics.enabled}
              onChange={(value) => settings.updateMetricsSetting("enabled", value)}
            />
            <SettingToggle
              label="Auto-Refresh Metrics"
              description="Automatically refresh metrics data in the background"
              value={settings.metrics.autoRefresh}
              onChange={(value) => settings.updateMetricsSetting("autoRefresh", value)}
            />
          </div>
        </div>

        {/* Display Preferences */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Display Preferences
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Customize the appearance and behavior of the UI
          </p>
          <div className="space-y-4">
            <SettingInput
              label="Items Per Page"
              value={settings.display.itemsPerPage}
              onChange={(value) => settings.updateDisplaySetting("itemsPerPage", value)}
              min={10}
              max={200}
              step={10}
            />
            <SettingToggle
              label="Compact Mode"
              description="Use smaller UI elements for a more compact display"
              value={settings.display.compactMode}
              onChange={(value) => settings.updateDisplaySetting("compactMode", value)}
            />
            <SettingToggle
              label="Show Namespace Column"
              description="Always show the namespace column in resource lists"
              value={settings.display.showNamespaceColumn}
              onChange={(value) => settings.updateDisplaySetting("showNamespaceColumn", value)}
            />
          </div>
        </div>

        {/* Performance Settings */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Performance Settings
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Optimize performance and network behavior
          </p>
          <div className="space-y-4">
            <SettingToggle
              label="Enable Auto-Refresh"
              description="Automatically refresh data in the background"
              value={settings.performance.enableAutoRefresh}
              onChange={(value) => settings.updatePerformanceSetting("enableAutoRefresh", value)}
            />
            <SettingInput
              label="Request Timeout (ms)"
              value={settings.performance.requestTimeout}
              onChange={(value) => settings.updatePerformanceSetting("requestTimeout", value)}
              min={5000}
              max={120000}
              step={5000}
            />
            <SettingInput
              label="Cache Stale Time (ms)"
              value={settings.performance.cacheStaleTime}
              onChange={(value) => settings.updatePerformanceSetting("cacheStaleTime", value)}
              min={0}
              max={10000}
              step={1000}
            />
            <SettingInput
              label="Max Retry Attempts"
              value={settings.performance.maxRetryAttempts}
              onChange={(value) => settings.updatePerformanceSetting("maxRetryAttempts", value)}
              min={0}
              max={10}
              step={1}
            />
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg md:col-span-2">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Advanced Settings
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Advanced configuration options
          </p>
          <div className="space-y-4">
            <SettingToggle
              label="Enable Animations"
              description="Enable or disable UI animations and transitions"
              value={settings.advanced.enableAnimations}
              onChange={(value) => settings.updateAdvancedSetting("enableAnimations", value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface SettingInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function SettingInput({ label, value, onChange, min = 0, max, step = 1 }: SettingInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Current value: {value}ms ({(value / 1000).toFixed(1)}s)
      </p>
    </div>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function SettingToggle({ label, description, value, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <label className="block text-sm font-medium">
          {label}
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
