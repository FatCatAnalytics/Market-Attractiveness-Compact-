import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { X, ArrowRight, Building2 } from "lucide-react";

interface SelectedProvidersPanelProps {
  selectedProviders: Set<string>;
  onClearSelections: () => void;
  onRemoveProvider: (provider: string) => void;
  onNavigateToAnalysis: () => void;
}

export function SelectedProvidersPanel({
  selectedProviders,
  onClearSelections,
  onRemoveProvider,
  onNavigateToAnalysis,
}: SelectedProvidersPanelProps) {
  if (selectedProviders.size === 0) return null;

  return (
    <Card className="fixed bottom-20 right-6 p-4 shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/90 dark:to-indigo-950/90 backdrop-blur-sm max-w-md z-[99999]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Selected Providers</h4>
          <Badge variant="secondary" className="text-xs">
            {selectedProviders.size}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelections}
          className="h-6 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
        >
          Clear All
        </Button>
      </div>

      <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
        {Array.from(selectedProviders).map((provider) => (
          <div
            key={provider}
            className="flex items-center justify-between bg-white dark:bg-gray-900 rounded px-3 py-2 border"
          >
            <span className="text-sm truncate flex-1" title={provider}>
              {provider}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveProvider(provider)}
              className="h-6 w-6 p-0 ml-2 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button onClick={onNavigateToAnalysis} className="w-full" size="sm">
        Analyse Competitors
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        Click providers in any table to add them to your selection
      </p>
    </Card>
  );
}