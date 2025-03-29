"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MergeTableContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainSessionId = searchParams.get("sessionId"); // ?sessionId=XXX (Ana session)

  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [tablesMap, setTablesMap] = useState({});
  const [selectedMergeSessionId, setSelectedMergeSessionId] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState(null);

  useEffect(() => {
    loadAllRegionsWithTrulyEmptyTables();
  }, []);

  /**
   * Sadece "gerçekten boş" masaları (session yok veya items dizisi boş) getirir.
   */
  async function loadAllRegionsWithTrulyEmptyTables() {
    try {
      const res = await fetch("/api/regions");
      if (!res.ok) throw new Error("Bölgeler alınamadı");
      const regionList = await res.json();

      // regionTablesMap: { [regionId]: [ { table, session: null } ] }
      const regionTablesMap = {};

      for (const r of regionList) {
        const regionRes = await fetch(
          `/api/region-tables-and-sessions?regionId=${r.id}`
        );
        if (!regionRes.ok)
          throw new Error("Bölge masaları/sessions alınamadı");
        const data = await regionRes.json();

        // Boş masaları filtrele:
        //   1) Session yoksa => boş
        //   2) Session varsa ama items dizisi 0 ise => boş
        const empties = data.tables
          .filter((t) => {
            const s = data.sessionMap[t.id];
            if (!s) return true; // hiç session yoksa boş
            if (s.items && s.items.length === 0) return true; // session var ama item yoksa boş
            return false; // aksi halde (items > 0) bu masa boş değil
          })
          .map((t) => ({
            table: t,
            // Görselde "Boş Masa" demek istiyorsak session'ı göstermiyoruz
            session: null,
          }));

        regionTablesMap[r.id] = empties;
      }

      setRegions(regionList);
      setTablesMap(regionTablesMap);

      // Varsayılan olarak ilk bölgeyi seçelim
      if (regionList.length > 0) {
        setSelectedRegionId(regionList[0].id);
      }
    } catch (err) {
      console.error("loadAllRegionsWithTrulyEmptyTables hatası:", err);
    }
  }

  function handleRegionTabClick(rid) {
    setSelectedRegionId(rid);
    setSelectedMergeSessionId(null);
    setSelectedTableId(null);
  }

  // Masa seçimi
  function handleTableClick(table) {
    setSelectedTableId(table.id);

    // Boş masaya tıklayınca isterseniz hemen open-table ile session oluşturup
    // selectedMergeSessionId'yi set edebilirsiniz:
    (async () => {
      try {
        const resp = await fetch("/api/open-table", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regionId: table.regionId,
            tableId: table.tableId,
          }),
        });
        if (!resp.ok) {
          const msg = await resp.text();
          throw new Error("Masa açma hatası: " + msg);
        }
        const newSession = await resp.json();
        setSelectedMergeSessionId(newSession.id);
      } catch (error) {
        console.error("handleTableClick hatası:", error);
        alert("Masa seçilirken hata oluştu.");
      }
    })();
  }

  async function handleMerge() {
    if (!mainSessionId || !selectedMergeSessionId) {
      alert("Lütfen bir ikinci masa (session) seçin.");
      return;
    }
    if (mainSessionId === selectedMergeSessionId) {
      alert("Aynı masayı/oturumu seçemezsiniz.");
      return;
    }

    try {
      const resp = await fetch("/api/merge-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainSessionId,
          mergeSessionId: selectedMergeSessionId,
        }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error("Birleştirme hatası: " + msg);
      }
      router.push("/orders");
    } catch (err) {
      console.error("Masa birleştirilirken hata:", err);
      alert("Masa birleştirilirken hata oluştu.");
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
          const emptiesCount = (tablesMap[r.id] || []).length;
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
              {r.name} ({emptiesCount})
            </button>
          );
        })}
      </div>

      {/* Orta Kısım: Gerçekten Boş Masalar */}
      <div className="flex-1 overflow-auto p-2 bg-gray-100">
        {selectedRegionId && tablesMap[selectedRegionId] ? (
          <div className="grid grid-cols-3 gap-2">
            {tablesMap[selectedRegionId].map(({ table }) => {
              const selected = selectedTableId === table.id;
              return (
                <div
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className={`border rounded aspect-square flex flex-col items-center justify-center cursor-pointer text-sm transition-colors ${
                    selected ? "bg-red-200 text-black" : "bg-white text-black"
                  }`}
                >
                  <div className="font-bold">
                    {table.alias ? table.alias : `Masa ${table.tableId}`}
                  </div>
                  <div className="text-xs mt-1">Boş Masa</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500 mt-4">
            Bu bölgede boş masa yok
          </div>
        )}
      </div>

      {/* Alt Kısım: Butonlar */}
      <div className="sticky bottom-0 border-t border-gray-300 bg-white flex">
        <button
          onClick={handleCancel}
          className="flex-1 py-3 text-center bg-gray-200 text-sm font-semibold"
        >
          İptal
        </button>
        <button
          onClick={handleMerge}
          disabled={!selectedMergeSessionId}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            selectedMergeSessionId
              ? "bg-red-600 text-white"
              : "bg-red-300 text-white"
          }`}
        >
          Masaları Birleştir
        </button>
      </div>
    </div>
  );
}
