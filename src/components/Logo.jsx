import { cn } from "@/lib/utils";

// Detention Shield mark — a shield (protection) with a clock inside
// (detention = waiting time). Amber accent only on the clock, per brand.
export default function Logo({ size = 40, withWordmark = true, className }) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M24 3 L40 9 V24 C40 36 33 43 24 45 C15 43 8 36 8 24 V9 Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          className="text-foreground"
        />
        <circle cx="24" cy="23.5" r="8.5" stroke="currentColor" strokeWidth="2" className="text-alert" />
        <path
          d="M24 19.5 V23.5 L27.6 25.6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-alert"
        />
        <circle cx="24" cy="23.5" r="1.4" fill="currentColor" className="text-alert" />
      </svg>
      {withWordmark && (
        <div className="leading-none">
          <div className="font-display font-bold text-lg tracking-tight">
            Detention Shield
          </div>
        </div>
      )}
    </div>
  );
}