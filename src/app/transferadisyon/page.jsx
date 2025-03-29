"use client";
import React, { Suspense } from "react";
import TransferAdisyonContent from "./TransferAdisyonContent";

export default function TransferAdisyonPage() {
  return (
    <Suspense fallback={<div>Loading Transfer Adisyon...</div>}>
      <TransferAdisyonContent />
    </Suspense>
  );
}
