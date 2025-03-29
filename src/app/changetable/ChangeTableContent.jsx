"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ChangeTableContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId"); // ?sessionId=XXX

  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [tablesMap, setTablesMap] = useState({});
  const [selectedTableId, setSelectedTableId] = useState(null);

  useEffect(() => {
    loadAllRegionsWithEmptyTables();
  }, []);

  async function loadAllRegionsWithEmptyTables() {
    try {
      const res = await fetch("/api/regions");
      if (!res.ok) throw new Error("Bölgeler alınamadı");
      const regionList = await res.json();

      // regionTablesMap: { [regionId]: [boşMasalarDizisi] }
      const regionTablesMap = {};

      for (const r of regionList) {
        const regionRes = await fetch(
          `/api/region-tables-and-sessions?regionId=${r.id}`
        );
        if (!regionRes.ok) throw new Error("Bölge masaları alınamadı");
        const data = await regionRes.json();

        // Boş masaları filtrele: session yoksa veya session'da items boşsa masa boş kabul edilir.
        const empties = data.tables.filter((t) => {
          const s = data.sessionMap[t.id];
          if (!s) return true;
          if (s.items && s.items.length === 0) return true;
          return false;
        });

        regionTablesMap[r.id] = empties;
      }

      setRegions(regionList);
      setTablesMap(regionTablesMap);

      // Varsayılan olarak ilk bölgeyi seçelim
      if (regionList.length > 0) {
        setSelectedRegionId(regionList[0].id);
      }
    } catch (err) {
      console.error("loadAllRegionsWithEmptyTables hatası:", err);
    }
  }

  function handleRegionTabClick(rid) {
    setSelectedRegionId(rid);
    setSelectedTableId(null);
  }

  function handleTableClick(tid) {
    setSelectedTableId(tid);
  }

  async function handleTransfer() {
    // Hata ayıklama için log ekliyoruz:
    console.log("Transfer denemesi:", { sessionId, selectedTableId });
    if (!sessionId || !selectedTableId) {
      alert("Lütfen önce bir masa seçin.");
      return;
    }
    try {
      const resp = await fetch("/api/transfer-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          newTableId: selectedTableId,
        }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error("Masa aktarılırken hata oluştu: " + msg);
      }
      router.push("/orders");
    } catch (err) {
      console.error("Masa aktarılırken hata:", err);
      alert("Masa aktarılırken hata oluştu.");
    }
  }

  function handleCancel() {
    router.push("/orders");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Bölge Sekmeleri */}
      <div className="flex border-b border-gray-300 bg-white overflow-x-auto">
        {regions.map((r) => {
          const empties = (tablesMap[r.id] || []).length;
          const active = selectedRegionId === r.id;
          return (
            <button
              key={r.id}
              onClick={() => handleRegionTabClick(r.id)}
              className={`flex-1 text-center py-3 font-semibold transition-colors ${
                active
                  ? "text-red-600 border-b-2 border-red-600"
                  : "text-gray-600"
              }`}
            >
              {r.name} ({empties})
            </button>
          );
        })}
      </div>

      {/* Orta Kısım: Boş Masalar Listesi */}
      <div className="flex-1 overflow-auto p-2 bg-gray-100">
        {selectedRegionId && tablesMap[selectedRegionId] ? (
          <div className="grid grid-cols-3 gap-2">
            {tablesMap[selectedRegionId].map((t) => (
              <div
                key={t.id}
                onClick={() => handleTableClick(t.id)}
                className={`border rounded aspect-square flex flex-col items-center justify-center cursor-pointer text-sm transition-colors ${
                  selectedTableId === t.id ? "bg-red-200" : "bg-white"
                }`}
              >
                {t.alias ? t.alias : `Masa ${t.tableId}`}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500 mt-4">
            Bu bölgede boş masa yok
          </div>
        )}
      </div>

      {/* Alt Kısım: Butonlar (Sticky) */}
      <div className="sticky bottom-0 border-t border-gray-300 bg-white flex">
        <button
          onClick={handleCancel}
          className="flex-1 py-3 text-center bg-gray-200 text-sm font-semibold"
        >
          İptal
        </button>
        <button
          onClick={handleTransfer}
          disabled={!selectedTableId}
          className={`flex-1 py-3 text-center text-sm font-semibold ${
            selectedTableId
              ? "bg-red-600 text-white"
              : "bg-red-300 text-white"
          }`}
        >
          Masa Değiştir
        </button>
      </div>
    </div>
  );
}
