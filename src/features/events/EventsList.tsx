import { useState, useMemo } from "react";
import { useEvents } from "../../hooks/useKube";
import { useAppStore } from "../../lib/store";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
  Activity,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
} from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { EventInfo } from "../../types";

// Parse relative time strings (e.g., "1h", "49m", "2d") to milliseconds timestamp
const parseRelativeTime = (timeStr: string): number => {
  const now = Date.now();
  const match = timeStr.match(/^(\d+)([smhd])$/);

  if (!match) {
    // Try to parse as a regular date string
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    return 0; // Return 0 for unparseable times (will be sorted last)
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,           // seconds
    m: 60 * 1000,      // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
  };

  const milliseconds = value * (multipliers[unit] || 0);
  return now - milliseconds; // Return the timestamp when this event occurred
};

export function EventsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setPodSearchFilter = useAppStore((state) => state.setPodSearchFilter);
  const setServiceSearchFilter = useAppStore((state) => state.setServiceSearchFilter);
  const { data: events, isLoading, error, refetch } = useEvents(currentNamespace);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "Normal" | "Warning">("all");
  const [objectTypeFilter, setObjectTypeFilter] = useState<string>("all");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  // Extract object type and name from event object string (format: "Kind/Name")
  const parseObjectInfo = (objectStr: string) => {
    const parts = objectStr.split("/");
    if (parts.length === 2) {
      return { kind: parts[0], name: parts[1] };
    }
    return { kind: "Unknown", name: objectStr };
  };

  // Navigate to resource page based on object type
  const navigateToObject = (objectStr: string) => {
    const { kind, name } = parseObjectInfo(objectStr);

    switch (kind.toLowerCase()) {
      case "pod":
        setPodSearchFilter(name);
        setCurrentView("pods");
        break;
      case "service":
        setServiceSearchFilter(name);
        setCurrentView("services");
        break;
      case "deployment":
        setCurrentView("deployments");
        break;
      case "statefulset":
        setCurrentView("statefulsets");
        break;
      case "daemonset":
        setCurrentView("daemonsets");
        break;
      case "job":
        setCurrentView("jobs");
        break;
      case "cronjob":
        setCurrentView("cronjobs");
        break;
      default:
        // For unknown types, don't navigate
        break;
    }
  };

  // Get unique object types from events
  const objectTypes = useMemo(() => {
    if (!events) return [];

    const types = new Set<string>();
    events.forEach((event) => {
      const { kind } = parseObjectInfo(event.object);
      types.add(kind);
    });

    return Array.from(types).sort();
  }, [events]);

  // Filter events based on search query, type filter, and object type filter
  const filteredEvents = useMemo(() => {
    if (!events) return [];

    return events.filter((event) => {
      const matchesSearch =
        searchQuery === "" ||
        event.object.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.message.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        typeFilter === "all" || event.event_type === typeFilter;

      const { kind } = parseObjectInfo(event.object);
      const matchesObjectType =
        objectTypeFilter === "all" || kind === objectTypeFilter;

      return matchesSearch && matchesType && matchesObjectType;
    });
  }, [events, searchQuery, typeFilter, objectTypeFilter]);

  // Calculate statistics from events
  const statistics = useMemo(() => {
    if (!events) return null;

    const normalCount = events.filter((e) => e.event_type === "Normal").length;
    const warningCount = events.filter((e) => e.event_type === "Warning").length;

    // Count events by reason
    const reasonCounts = events.reduce((acc, event) => {
      acc[event.reason] = (acc[event.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get top 5 reasons
    const topReasons = Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    // Calculate recent events (last hour)
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentEvents = events.filter((event) => {
      const lastSeenTimestamp = parseRelativeTime(event.last_seen);
      return lastSeenTimestamp >= oneHourAgo;
    }).length;

    return {
      total: events.length,
      normalCount,
      warningCount,
      topReasons,
      recentEvents,
    };
  }, [events]);

  // Group events by timeline
  const groupedEvents = useMemo(() => {
    if (!filteredEvents) return null;

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const groups = {
      recent: [] as EventInfo[],
      today: [] as EventInfo[],
      yesterday: [] as EventInfo[],
      older: [] as EventInfo[],
    };

    filteredEvents.forEach((event) => {
      const lastSeenTimestamp = parseRelativeTime(event.last_seen);

      if (lastSeenTimestamp >= oneHourAgo) {
        groups.recent.push(event);
      } else if (lastSeenTimestamp >= startOfToday.getTime()) {
        groups.today.push(event);
      } else if (lastSeenTimestamp >= startOfYesterday.getTime()) {
        groups.yesterday.push(event);
      } else {
        groups.older.push(event);
      }
    });

    // Sort each group by last_seen timestamp (newest first)
    const sortByLastSeen = (a: EventInfo, b: EventInfo) => {
      const timestampA = parseRelativeTime(a.last_seen);
      const timestampB = parseRelativeTime(b.last_seen);
      return timestampB - timestampA; // Descending order (newest first)
    };

    groups.recent.sort(sortByLastSeen);
    groups.today.sort(sortByLastSeen);
    groups.yesterday.sort(sortByLastSeen);
    groups.older.sort(sortByLastSeen);

    return groups;
  }, [filteredEvents]);

  const getTypeVariant = (type: string) => {
    if (type === "Warning") return "warning";
    if (type === "Error") return "destructive";
    return "secondary";
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading events..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading events: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Events
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredEvents?.length || 0} {(searchQuery || typeFilter !== "all") && `of ${events?.length || 0}`}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by reason, object, or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant={typeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("all")}
              >
                All
              </Button>
              <Button
                variant={typeFilter === "Normal" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("Normal")}
              >
                Normal
              </Button>
              <Button
                variant={typeFilter === "Warning" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("Warning")}
              >
                Warning
              </Button>
            </div>
          </div>

          {/* Object Type Filters */}
          {objectTypes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Object Type:</span>
              <Button
                variant={objectTypeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setObjectTypeFilter("all")}
                className="text-xs h-7"
              >
                All
              </Button>
              {objectTypes.map((type) => (
                <Button
                  key={type}
                  variant={objectTypeFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setObjectTypeFilter(type)}
                  className="text-xs h-7"
                >
                  {type}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Dashboard */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Events */}
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Events</p>
                <p className="text-3xl font-bold text-foreground">
                  {statistics.total}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <Activity className="w-6 h-6 text-foreground/70" />
              </div>
            </div>
          </div>

          {/* Normal Events */}
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Normal</p>
                <p className="text-3xl font-bold text-foreground">
                  {statistics.normalCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {statistics.total > 0
                    ? `${Math.round((statistics.normalCount / statistics.total) * 100)}%`
                    : "0%"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <CheckCircle2 className="w-6 h-6 text-foreground/70" />
              </div>
            </div>
          </div>

          {/* Warning Events */}
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Warnings</p>
                <p className="text-3xl font-bold text-foreground">
                  {statistics.warningCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {statistics.total > 0
                    ? `${Math.round((statistics.warningCount / statistics.total) * 100)}%`
                    : "0%"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <AlertTriangle className="w-6 h-6 text-foreground/70" />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Last Hour</p>
                <p className="text-3xl font-bold text-foreground">
                  {statistics.recentEvents}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recent activity
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <TrendingUp className="w-6 h-6 text-foreground/70" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Reasons */}
      {statistics && statistics.topReasons.length > 0 && (
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Top Event Reasons
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {statistics.topReasons.map((item, idx) => (
              <div
                key={item.reason}
                className="p-3 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border border-border/30 hover:border-primary/50 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  <Badge variant="secondary" className="text-xs">
                    {item.count}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate" title={item.reason}>
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline-based Event Groups */}
      {!filteredEvents || filteredEvents.length === 0 ? (
        <div className="p-12 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg text-center">
          <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">
            {!events || events.length === 0
              ? `No events found in namespace "${currentNamespace}"`
              : searchQuery || typeFilter !== "all"
              ? "No events match your search criteria"
              : "No events found"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEvents && groupedEvents.recent.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                <Clock className="w-4 h-4" />
                <span>Recent (Last Hour)</span>
                <Badge variant="secondary" className="ml-2">
                  {groupedEvents.recent.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedEvents.recent.map((event, idx) => {
                  const eventId = `recent-${idx}`;
                  const isExpanded = expandedEvents.has(eventId);
                  return (
                    <div
                      key={eventId}
                      className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-border transition-all"
                    >
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => toggleEventExpanded(eventId)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Badge variant={getTypeVariant(event.event_type)}>
                                  {event.event_type}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {event.reason}
                                </Badge>
                                {event.count > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.count}x
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {event.message}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <Badge
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToObject(event.object);
                              }}
                              title={`Click to view ${event.object}`}
                            >
                              <Package className="w-3 h-3 mr-1" />
                              {event.object}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{event.last_seen}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-border/30 mt-2 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Object:</span>
                              <p className="font-mono mt-1">{event.object}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Source:</span>
                              <p className="font-mono mt-1">{event.source}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">First Seen:</span>
                              <p className="mt-1">{event.first_seen}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Seen:</span>
                              <p className="mt-1">{event.last_seen}</p>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-sm">Message:</span>
                            <p className="mt-1 text-sm bg-muted/30 p-3 rounded-lg">
                              {event.message}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {groupedEvents && groupedEvents.today.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                <Clock className="w-4 h-4" />
                <span>Today</span>
                <Badge variant="secondary" className="ml-2">
                  {groupedEvents.today.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedEvents.today.map((event, idx) => {
                  const eventId = `today-${idx}`;
                  const isExpanded = expandedEvents.has(eventId);
                  return (
                    <div
                      key={eventId}
                      className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-border transition-all"
                    >
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => toggleEventExpanded(eventId)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Badge variant={getTypeVariant(event.event_type)}>
                                  {event.event_type}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {event.reason}
                                </Badge>
                                {event.count > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.count}x
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {event.message}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <Badge
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToObject(event.object);
                              }}
                              title={`Click to view ${event.object}`}
                            >
                              <Package className="w-3 h-3 mr-1" />
                              {event.object}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{event.last_seen}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-border/30 mt-2 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Object:</span>
                              <p className="font-mono mt-1">{event.object}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Source:</span>
                              <p className="font-mono mt-1">{event.source}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">First Seen:</span>
                              <p className="mt-1">{event.first_seen}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Seen:</span>
                              <p className="mt-1">{event.last_seen}</p>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-sm">Message:</span>
                            <p className="mt-1 text-sm bg-muted/30 p-3 rounded-lg">
                              {event.message}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {groupedEvents && groupedEvents.yesterday.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                <Clock className="w-4 h-4" />
                <span>Yesterday</span>
                <Badge variant="secondary" className="ml-2">
                  {groupedEvents.yesterday.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedEvents.yesterday.map((event, idx) => {
                  const eventId = `yesterday-${idx}`;
                  const isExpanded = expandedEvents.has(eventId);
                  return (
                    <div
                      key={eventId}
                      className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-border transition-all"
                    >
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => toggleEventExpanded(eventId)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Badge variant={getTypeVariant(event.event_type)}>
                                  {event.event_type}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {event.reason}
                                </Badge>
                                {event.count > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.count}x
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {event.message}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <Badge
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToObject(event.object);
                              }}
                              title={`Click to view ${event.object}`}
                            >
                              <Package className="w-3 h-3 mr-1" />
                              {event.object}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{event.last_seen}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-border/30 mt-2 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Object:</span>
                              <p className="font-mono mt-1">{event.object}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Source:</span>
                              <p className="font-mono mt-1">{event.source}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">First Seen:</span>
                              <p className="mt-1">{event.first_seen}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Seen:</span>
                              <p className="mt-1">{event.last_seen}</p>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-sm">Message:</span>
                            <p className="mt-1 text-sm bg-muted/30 p-3 rounded-lg">
                              {event.message}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {groupedEvents && groupedEvents.older.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                <Clock className="w-4 h-4" />
                <span>Older</span>
                <Badge variant="secondary" className="ml-2">
                  {groupedEvents.older.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedEvents.older.map((event, idx) => {
                  const eventId = `older-${idx}`;
                  const isExpanded = expandedEvents.has(eventId);
                  return (
                    <div
                      key={eventId}
                      className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-border transition-all"
                    >
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => toggleEventExpanded(eventId)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Badge variant={getTypeVariant(event.event_type)}>
                                  {event.event_type}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {event.reason}
                                </Badge>
                                {event.count > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.count}x
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {event.message}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <Badge
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToObject(event.object);
                              }}
                              title={`Click to view ${event.object}`}
                            >
                              <Package className="w-3 h-3 mr-1" />
                              {event.object}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{event.last_seen}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-border/30 mt-2 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Object:</span>
                              <p className="font-mono mt-1">{event.object}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Source:</span>
                              <p className="font-mono mt-1">{event.source}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">First Seen:</span>
                              <p className="mt-1">{event.first_seen}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Seen:</span>
                              <p className="mt-1">{event.last_seen}</p>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-sm">Message:</span>
                            <p className="mt-1 text-sm bg-muted/30 p-3 rounded-lg">
                              {event.message}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
