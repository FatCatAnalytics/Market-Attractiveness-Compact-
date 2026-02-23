interface WeightSliderProps {
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
  label: string;
}

export function WeightSlider({ value, defaultValue, onChange, label }: WeightSliderProps) {
  // Safety check for NaN values
  const safeValue = isNaN(value) ? 0 : value;
  const safeDefault = isNaN(defaultValue) ? 0 : defaultValue;
  
  const isIncreased = safeValue > safeDefault;
  const isDecreased = safeValue < safeDefault;
  const min = Math.min(safeValue, safeDefault);
  const max = Math.max(safeValue, safeDefault);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={safeValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-12 h-6 text-xs text-right px-1.5 border border-input rounded bg-background"
            min={0}
            max={100}
          />
          {safeValue !== safeDefault && (
            <span className={`text-xs min-w-[2rem] text-right ${isIncreased ? 'text-green-600' : 'text-red-600'}`}>
              {isIncreased ? '+' : ''}{safeValue - safeDefault}
            </span>
          )}
        </div>
      </div>

      {/* Custom multi-colored track visualization */}
      <div className="relative h-2.5">
        {/* Background track */}
        <div className="absolute inset-0 bg-muted rounded-full" />
        
        {/* Blue segment for default value */}
        <div
          className={`absolute h-full bg-blue-600 rounded-l-full transition-all ${safeValue === safeDefault ? 'rounded-r-full' : ''}`}
          style={{ width: `${safeDefault}%` }}
        />
        
        {/* Green segment for increase (from default to current) */}
        {isIncreased && (
          <div
            className="absolute h-full bg-green-600 transition-all rounded-r-full"
            style={{ 
              left: `${safeDefault}%`,
              width: `${safeValue - safeDefault}%`
            }}
          />
        )}
        
        {/* Red segment for decrease (from current to default) */}
        {isDecreased && (
          <div
            className="absolute h-full bg-red-600 transition-all"
            style={{ 
              left: `${safeValue}%`,
              width: `${safeDefault - safeValue}%`
            }}
          />
        )}

        {/* Default value marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-blue-800 z-10"
          style={{ left: `${safeDefault}%` }}
        >
          <div className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-blue-800 border border-background" />
        </div>

        {/* Current value thumb */}
        <input
          type="range"
          value={safeValue}
          onChange={(e) => onChange(Number(e.target.value))}
          min={0}
          max={100}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-background border-2 shadow-sm transition-all z-10 pointer-events-none"
          style={{ 
            left: `calc(${safeValue}% - 6px)`,
            borderColor: isIncreased ? '#16a34a' : isDecreased ? '#dc2626' : '#2563eb'
          }}
        />
      </div>
    </div>
  );
}
