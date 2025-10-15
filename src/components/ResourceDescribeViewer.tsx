import { useEffect, useState } from "react";
import { X, Calendar, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAppStore } from "../lib/store";

interface ResourceDescribeViewerProps {
  resourceType: string;
  namespace?: string;
  name: string;
  onClose: () => void;
}

interface Event {
  type: string;
  reason: string;
  age: string;
  from: string;
  message: string;
}

function parseEvents(description: string): Event[] {
  const events: Event[] = [];
  const lines = description.split('\n');

  // Find the Events section
  let inEventsSection = false;
  let headerFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^Events:/)) {
      inEventsSection = true;
      continue;
    }

    if (inEventsSection && line.match(/^\s*Type\s+Reason\s+Age/)) {
      headerFound = true;
      continue;
    }

    if (inEventsSection && line.match(/^\s*----/)) {
      continue;
    }

    if (inEventsSection && headerFound && line.trim()) {
      // Parse event line
      const match = line.match(/^\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (match) {
        events.push({
          type: match[1],
          reason: match[2],
          age: match[3],
          from: match[4],
          message: match[5].trim(),
        });
      }
    }

    // Stop if we hit another section or empty lines after events
    if (inEventsSection && headerFound && line.match(/^[A-Z][a-z]+:/)) {
      break;
    }
  }

  return events;
}

function parseSections(description: string): { [key: string]: string } {
  const sections: { [key: string]: string } = {};
  const lines = description.split('\n');
  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check if this is a section header (starts with capital letter and ends with colon)
    const sectionMatch = line.match(/^([A-Z][a-zA-Z\s]+):\s*$/);
    if (sectionMatch) {
      // Save previous section
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n');
      }
      currentSection = sectionMatch[1];
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n');
  }

  return sections;
}

export function ResourceDescribeViewer({
  resourceType,
  namespace,
  name,
  onClose,
}: ResourceDescribeViewerProps) {
  const theme = useAppStore((state) => state.theme);
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'details' | 'full'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [sections, setSections] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchDescription = async () => {
      setLoading(true);
      setError(null);
      try {
        const desc = await api.describeResource(resourceType, namespace, name);
        setDescription(desc);

        // Parse events and sections
        const parsedEvents = parseEvents(desc);
        setEvents(parsedEvents);

        const parsedSections = parseSections(desc);
        setSections(parsedSections);

        // Default to events tab if events exist, otherwise details
        if (parsedEvents.length > 0) {
          setActiveTab('events');
        } else {
          setActiveTab('details');
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch resource description"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDescription();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [resourceType, namespace, name, onClose]);

  const getTypeColor = (type: string) => {
    if (type.toLowerCase() === 'normal') return 'text-green-600 dark:text-green-400';
    if (type.toLowerCase() === 'warning') return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getTypeBgColor = (type: string) => {
    if (type.toLowerCase() === 'normal') return 'bg-green-100 dark:bg-green-900/20';
    if (type.toLowerCase() === 'warning') return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col bg-background border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {resourceType} {namespace && `• ${namespace}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        {!loading && !error && (
          <div className="flex border-b border-border px-6">
            <button
              onClick={() => setActiveTab('events')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'events'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Events {events.length > 0 && `(${events.length})`}
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('full')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'full'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Full Description
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading description...</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive rounded-lg px-4 py-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Error</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && activeTab === 'events' && (
            <div>
              {events.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No events found for this resource</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border border-border p-4 ${getTypeBgColor(event.type)}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(event.type)}`}>
                            {event.type}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-3 mb-1">
                            <p className="font-semibold text-foreground">{event.reason}</p>
                            <span className="text-xs text-muted-foreground">{event.age}</span>
                          </div>
                          <p className="text-sm text-foreground/80 mb-1">{event.message}</p>
                          <p className="text-xs text-muted-foreground">From: {event.from}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !error && activeTab === 'details' && (
            <div className="space-y-6">
              {Object.keys(sections).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No structured details available</p>
                </div>
              ) : (
                Object.entries(sections)
                  .filter(([key]) => key !== 'Events')
                  .map(([section, content]) => (
                    <div key={section} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2 border-b border-border">
                        <h3 className="font-semibold text-foreground">{section}</h3>
                      </div>
                      <div className="p-4 bg-background">
                        <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/80">
                          {content.trim()}
                        </pre>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {!loading && !error && activeTab === 'full' && (
            <div className="border border-border rounded-lg p-4 bg-muted/50">
              <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground">
                {description}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            Close (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}
