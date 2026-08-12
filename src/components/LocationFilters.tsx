import { LOCATION_GROUPS } from "@/lib/locations";

interface LocationFiltersProps {
  selected: string;
  onChange: (location: string) => void;
}

export default function LocationFilters({
  selected,
  onChange,
}: LocationFiltersProps) {
  const getActiveGroupLabel = () => {
    if (selected === "All Locations") return "All Locations";
    const matchedGroup = LOCATION_GROUPS.find((group) =>
      group.locations.some((loc) => loc === selected)
    );
    return matchedGroup ? matchedGroup.label : "All Locations";
  };

  const activeGroupLabel = getActiveGroupLabel();
  const activeGroup = LOCATION_GROUPS.find((g) => g.label === activeGroupLabel);

  return (
    <div className="space-y-2.5">
      {/* Primary Location Chips */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
        role="tablist"
        aria-label="Filter items by campus location"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selected === "All Locations"}
          onClick={() => onChange("All Locations")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ${
            selected === "All Locations"
              ? "bg-[#7A1F2B] text-white shadow-2xs"
              : "border border-[#E8E6E1] bg-white text-[#171717] hover:border-[#7A1F2B]/30 hover:bg-[#FAFAF8]"
          }`}
        >
          All Locations
        </button>

        {LOCATION_GROUPS.map((group) => {
          const isActiveBlock = activeGroupLabel === group.label;
          return (
            <button
              key={group.label}
              type="button"
              role="tab"
              aria-selected={isActiveBlock}
              onClick={() => {
                if (!isActiveBlock) {
                  onChange(group.locations[0]);
                }
              }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ${
                isActiveBlock
                  ? "bg-[#7A1F2B] text-white shadow-2xs"
                  : "border border-[#E8E6E1] bg-white text-[#171717] hover:border-[#7A1F2B]/30 hover:bg-[#FAFAF8]"
              }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Sub-floor Chips */}
      {activeGroup && activeGroup.locations.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E8E6E1]/70 animate-fade-in">
          <span className="text-[10px] font-semibold text-[#6B6B67] mr-1 uppercase tracking-wider">
            Floor:
          </span>
          {activeGroup.locations.map((loc) => {
            const floorLabel = loc
              .replace(`${activeGroup.label} - `, "")
              .replace(" Block", "");
            const isFloorSelected = selected === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => onChange(loc)}
                className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition duration-150 ${
                  isFloorSelected
                    ? "bg-[#631822] text-white shadow-2xs"
                    : "border border-[#E8E6E1] bg-white text-[#6B6B67] hover:text-[#171717] hover:bg-[#FAFAF8]"
                }`}
              >
                {floorLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
