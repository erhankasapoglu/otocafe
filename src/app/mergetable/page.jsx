"use client";
import React, { Suspense } from "react";
import MergeTableContent from "./MergeTableContent";

export default function MergeTablePage() {
  return (
    <Suspense fallback={<div>Loading Merge Table...</div>}>
      <MergeTableContent />
    </Suspense>
  );
}
