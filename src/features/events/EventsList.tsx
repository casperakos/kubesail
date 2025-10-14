import { useState } from "react";
import { useEvents } from "../../hooks/useKube";
import { useAppStore } from "../../lib/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { RefreshCw, Search, X } from "lucide-react";

export function EventsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: events, isLoading, error, refetch } = useEvents(currentNamespace);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "Normal" | "Warning">("all");

  const filteredEvents = events?.filter((event) => {
    const matchesSearch =
      searchQuery === "" ||
      event.object.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      typeFilter === "all" || event.event_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const getTypeVariant = (type: string) => {
    if (type === "Warning") return "warning";
    if (type === "Error") return "destructive";
    return "secondary";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading events: {error.message}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No events found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Events</h2>
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

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
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

      <div className="text-sm text-muted-foreground">
        Showing {filteredEvents?.length || 0} of {events.length} events
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Object</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Last Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents && filteredEvents.length > 0 ? (
              filteredEvents.map((event, idx) => (
                <TableRow key={`${event.object}-${event.reason}-${idx}`}>
                  <TableCell>
                    <Badge variant={getTypeVariant(event.event_type)}>
                      {event.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{event.reason}</TableCell>
                  <TableCell className="text-sm">{event.object}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground truncate">
                      {event.message}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.source}
                  </TableCell>
                  <TableCell>
                    {event.count > 1 && (
                      <Badge variant="secondary">{event.count}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.last_seen}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No events match your filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
