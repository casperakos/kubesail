export function Logo({ size = "default" }: { size?: "default" | "small" }) {
  const dimensions = size === "small" ? "w-8 h-8" : "w-10 h-10";
  const iconSize = size === "small" ? "24" : "32";

  return (
    <div className="flex items-center gap-3">
      <div className={`${dimensions} relative group`}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl opacity-90 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>

        {/* Icon container */}
        <div className="relative h-full flex items-center justify-center">
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10"
          >
            {/* Helm/Ship Wheel Icon - representing navigation/sailing */}
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
              fill="white"
            />
            {/* Spokes */}
            <line x1="12" y1="2" x2="12" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="15" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="12" x2="9" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="15" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="5" y1="5" x2="9.5" y2="9.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="19" y1="5" x2="14.5" y2="9.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="9.5" y1="14.5" x2="5" y2="19" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {size === "default" && (
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            KubeSail
          </h1>
          <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
            KUBERNETES MANAGEMENT
          </p>
        </div>
      )}
    </div>
  );
}
