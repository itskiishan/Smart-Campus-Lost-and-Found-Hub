interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
        <svg
          className="h-4 w-4 text-[#6B6B67]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>

      <input
        type="text"
        placeholder="Search for an item, category, or location..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#E8E6E1] bg-white py-2.5 pl-10 pr-9 text-xs font-medium text-[#171717] placeholder-[#6B6B67] shadow-2xs transition duration-150 focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15 sm:text-sm"
        aria-label="Search for an item, category, or location"
      />

      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#6B6B67] hover:text-[#171717] focus:outline-none"
          title="Clear search"
          type="button"
          aria-label="Clear search input"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
