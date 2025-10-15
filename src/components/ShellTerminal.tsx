import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { X, Maximize2, Minimize2, Terminal as TerminalIcon } from "lucide-react";
import { useAppStore } from "../lib/store";
import "@xterm/xterm/css/xterm.css";

interface ShellTerminalProps {
  podName: string;
  namespace: string;
  container?: string;
  onClose: () => void;
}

export function ShellTerminal({
  podName,
  namespace,
  container: initialContainer,
  onClose,
}: ShellTerminalProps) {
  const theme = useAppStore((state) => state.theme);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [session, setSessionId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "closed">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [containers, setContainers] = useState<string[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(initialContainer || null);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const sessionRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch containers list
  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const containerList = await invoke<string[]>("get_pod_containers", {
          podName,
          namespace,
        });
        setContainers(containerList);
        if (!selectedContainer && containerList.length > 0) {
          setSelectedContainer(containerList[0]);
        }
      } catch (error) {
        console.error("Failed to get containers:", error);
        setErrorMessage(`Failed to get pod containers: ${error}`);
        setStatus("error");
      } finally {
        setLoadingContainers(false);
      }
    };
    fetchContainers();
  }, [podName, namespace]);

  // Initialize terminal and connect when user clicks connect
  useEffect(() => {
    if (!terminalRef.current || !selectedContainer || loadingContainers || !isConnected) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: theme === "dark" ? "#1e1e1e" : "#ffffff",
        foreground: theme === "dark" ? "#d4d4d4" : "#000000",
        cursor: theme === "dark" ? "#aeafad" : "#000000",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
      rows: 30,
      cols: 120,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    fitAddonRef.current = fitAddon;

    // Open terminal
    term.open(terminalRef.current);
    fitAddon.fit();

    setTerminal(term);

    // Start shell session
    const startSession = async () => {
      try {
        term.writeln("Connecting to pod...\r\n");

        // Call start_shell_session - this waits for the connection to be established
        const sessionId = await invoke<string>("start_shell_session", {
          podName,
          namespace,
          container: selectedContainer,
          shell: null, // Will try bash, sh, ash
        });

        setSessionId(sessionId);
        sessionRef.current = sessionId;

        // If we got here, connection is established (exec() waits for connection)
        setStatus("connected");
        term.writeln(`Connected to ${podName}\r\n`);

        // Set up event listeners for output
        const outputUnlisten = await listen<string>(
          `shell-output-${sessionId}`,
          (event) => {
            term.write(event.payload);
          }
        );

        const errorUnlisten = await listen<string>(
          `shell-error-${sessionId}`,
          (event) => {
            term.writeln(`\r\n\x1b[31mError: ${event.payload}\x1b[0m\r\n`);
            setStatus("error");
            setErrorMessage(event.payload);
          }
        );

        const closedUnlisten = await listen(
          `shell-closed-${sessionId}`,
          () => {
            term.writeln("\r\n\x1b[33mConnection closed\x1b[0m\r\n");
            setStatus("closed");
          }
        );

        // Clean up listeners on unmount
        return () => {
          outputUnlisten();
          errorUnlisten();
          closedUnlisten();
        };
      } catch (error) {
        term.writeln(`\r\n\x1b[31mFailed to connect: ${error}\x1b[0m\r\n`);
        setStatus("error");
        setErrorMessage(String(error));
      }
    };

    const cleanupPromise = startSession();

    // Handle terminal input
    term.onData((data) => {
      if (sessionRef.current) {
        invoke("send_shell_input", {
          sessionId: sessionRef.current,
          data,
        }).catch((error) => {
          console.error("Failed to send input:", error);
        });
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cleanupPromise.then((cleanup) => cleanup?.());
      term.dispose();
    };
  }, [podName, namespace, selectedContainer, theme, isConnected]);

  const handleConnect = () => {
    if (!selectedContainer) {
      setErrorMessage("Please select a container");
      return;
    }
    setStatus("connecting");
    setIsConnected(true);
  };

  const handleClose = async () => {
    if (session) {
      try {
        await invoke("close_shell_session", { sessionId: session });
      } catch (error) {
        console.error("Failed to close session:", error);
      }
    }
    sessionRef.current = null;
    onClose();
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    // Trigger a fit after the transition
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`flex flex-col bg-background border border-border rounded-xl shadow-2xl transition-all duration-300 ${
          isMaximized ? "w-full h-full" : "w-[90%] h-[80%]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  status === "connected"
                    ? "bg-green-500"
                    : status === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : status === "error"
                    ? "bg-red-500"
                    : status === "idle"
                    ? "bg-gray-400"
                    : "bg-gray-500"
                }`}
              />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {podName}
                </h2>
                <p className="text-xs text-muted-foreground">{namespace}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <button
                onClick={toggleMaximize}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isConnected ? (
          /* Connection Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <TerminalIcon size={32} className="text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Connect to Pod Shell
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a container and click connect to open a shell session
                </p>
              </div>
            </div>

            <div className="w-full max-w-md space-y-4">
              {containers.length > 1 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Container
                  </label>
                  <select
                    value={selectedContainer || ""}
                    onChange={(e) => setSelectedContainer(e.target.value)}
                    disabled={loadingContainers}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    {containers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    This pod has {containers.length} containers
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground">
                    Container: <span className="font-mono text-foreground">{selectedContainer}</span>
                  </p>
                </div>
              )}

              {status === "error" && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={!selectedContainer || loadingContainers}
                className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <TerminalIcon size={18} />
                Connect to Shell
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Terminal */}
            <div className="flex-1 overflow-hidden p-2 bg-[#1e1e1e]">
              <div
                ref={terminalRef}
                className="w-full h-full"
                style={{ minHeight: 0 }}
              />
            </div>

            {/* Status Bar */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>
                  Status:{" "}
                  <span
                    className={`font-medium ${
                      status === "connected"
                        ? "text-green-600 dark:text-green-400"
                        : status === "connecting"
                        ? "text-yellow-600 dark:text-yellow-400"
                        : status === "error"
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {status === "connected"
                      ? "Connected"
                      : status === "connecting"
                      ? "Connecting..."
                      : status === "error"
                      ? `Error: ${errorMessage}`
                      : "Closed"}
                  </span>
                </span>
                {session && <span className="font-mono">Session: {session.slice(0, 8)}...</span>}
              </div>
              <span className="text-muted-foreground">
                Press Ctrl+C to interrupt, Ctrl+D or type 'exit' to close
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
