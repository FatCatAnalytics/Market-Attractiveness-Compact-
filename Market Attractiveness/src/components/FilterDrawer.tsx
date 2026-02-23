import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { WhatIfAnalysis } from "./WhatIfAnalysis";
import { Weights, BucketAssignment } from "../utils/scoreCalculation";
import { GlobalFilters } from "../types";

interface FilterDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: any[];
  weights: Weights;
  setWeights: (weights: Weights) => void;
  bucketAssignments: BucketAssignment[];
  setBucketAssignments: (assignments: BucketAssignment[]) => void;
  bucketWeights: { high: number; medium: number };
  setBucketWeights: (weights: { high: number; medium: number }) => void;
  globalFilters: GlobalFilters;
  setGlobalFilters: (filters: GlobalFilters) => void;
  resetGlobalFilters: () => void;
}

export function FilterDrawer({
  isOpen,
  onOpenChange,
  data,
  weights,
  setWeights,
  bucketAssignments,
  setBucketAssignments,
  bucketWeights,
  setBucketWeights,
  globalFilters,
  setGlobalFilters,
  resetGlobalFilters,
}: FilterDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Filters & Preferences</SheetTitle>
          <SheetDescription>
            Customize weights, bucket assignments, and global filters to refine your market analysis
          </SheetDescription>
        </SheetHeader>
        
        <div>
          <WhatIfAnalysis
            data={data}
            weights={weights}
            setWeights={setWeights}
            bucketAssignments={bucketAssignments}
            setBucketAssignments={setBucketAssignments}
            bucketWeights={bucketWeights}
            setBucketWeights={setBucketWeights}
            globalFilters={globalFilters}
            setGlobalFilters={setGlobalFilters}
            resetGlobalFilters={resetGlobalFilters}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}