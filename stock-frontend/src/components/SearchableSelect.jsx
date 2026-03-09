import { useMemo, useState } from "react";

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Search...",
  showSearch = true,
  disabled = false,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <div className="searchable-select">
      <label>{label}</label>
      {showSearch ? (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : null}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">Select {label}</option>
        {filtered.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
