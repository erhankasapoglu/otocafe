"use client";
import React, { Suspense } from "react";
import ChangeTableContent from "./ChangeTableContent";

export default function ChangeTablePage() {
  return (
    <Suspense fallback={<div>Loading Change Table...</div>}>
      <ChangeTableContent />
    </Suspense>
  );
}
