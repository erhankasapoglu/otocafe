"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function TransferAdisyonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceSessionId = searchParams.get("sourceSessionId"); // ?sourceSessionId=XXX

  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  // Her bölge için açık (open) oturumlara sahip masaları tutuyoruz
  // Yapı: { [regionId]: [ { table, session }, ... ] }
  const [tablesMap, setTablesMap] = useState({});
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // 1) İlk yüklemede bölgeleri ve açık oturumlu masaları getir
  useEffect(() => {
    loadAllRegionsWithOpenSessions();
  }, []);

  async function loadAllRegionsWithOpenSessions() {
    try {
      const res = await fetch("/api/regions");
      if (!res.ok) throw new Error("Bölgeler alınamadı");
      const regionList = await res.json();

      const regionTablesMap = {};

      for (const r of regionList) {
        const regionRes = await fetch(
          `/api/region-tables-and-sessions?regionId=${r.id}`
        );
        if (!regionRes.ok) throw new Error("Bölge masaları alınamadı");
        const data = await regionRes.json();

        // Sadece "open" durumunda olan oturumları listeleyelim
        const openSessions = [];
        for (const tbl of data.tables) {
          const sess = data.sessionMap[tbl.id];
          if (sess && sess.status === "open") {
            openSessions.push({ table: tbl, session: sess });
          }
        }
        regionTablesMap[r.id] = openSessions;
      }

      setRegions(regionList);
      setTablesMap(regionTablesMap);

      // Varsayılan olarak ilk bölgeyi seçelim
      if (regionList.length > 0) {
        setSelectedRegionId(regionList[0].id);
      }
    } catch (err) {
      console.error("loadAllRegionsWithOpenSessions hatası:", err);
    }
  }

  // 2) Bölge sekmesine tıklayınca
  function handleRegionTabClick(rid) {
    setSelectedRegionId(rid);
    setSelectedSessionId(null);
  }

  // 3) Bir masa/oturum seçilince
  function handleTableClick(targetSessId) {
    setSelectedSessionId(targetSessId);
  }

  // 4) “Adisyon Aktar” butonu
  async function handleTransfer() {
    if (!sourceSessionId || !selectedSessionId) {
      alert("Lütfen bir hedef oturum seçin.");
      return;
    }
    try {
      const resp = await fetch("/api/transfer-adisyon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSessionId,
          targetSessionId: selectedSessionId,
        }),
      });
      if (!resp.ok) {
        throw new Error("Adisyon aktarılırken hata oluştu.");
      }
      // Başarılıysa Orders sayfasına dön
      router.push("/orders");
    } catch (err) {
      console.error("Adisyon aktarılırken hata:", err);
      alert("Adisyon aktarılırken hata oluştu.");
    }
  }

  // 5) “İptal” butonu
  function handleCancel() {
    router.push("/orders");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Bölge Sekmeleri */}
      <div className="flex border-b border-gray-300 bg-white overflow-x-auto">
        {regions.map((r) => {
          const openCount = (tablesMap[r.id] || []).length;
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
              {r.name} ({openCount})
            </button>
          );
        })}
      </div>

      {/* Orta Kısım: Açık Oturumlu Masalar Listesi */}
      <div className="flex-1 overflow-auto p-2 bg-gray-100">
        {selectedRegionId && tablesMap[selectedRegionId] ? (
          <div className="grid grid-cols-3 gap-2">
            {tablesMap[selectedRegionId].map(({ table, session }) => (
              <div
                key={session.id}
                onClick={() => handleTableClick(session.id)}
                className={`border rounded aspect-square flex flex-col items-center justify-center cursor-pointer text-sm ${
                  selectedSessionId === session.id ? "bg-blue-200" : "bg-white"
                }`}
              >
                {/* Masa adı veya alias */}
                <div>
                  {table.alias ? table.alias : `Masa ${table.tableId}`}
                </div>
                {/* Oturum kimliği veya ek bilgiler */}
                <div className="text-xs text-gray-600">
                  Oturum: {session.id.slice(0, 6)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500 mt-4">
            Bu bölgede açık masa yok
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
          disabled={!selectedSessionId}
          className={`flex-1 py-3 text-center text-sm font-semibold ${
            selectedSessionId
              ? "bg-red-600 text-white"
              : "bg-red-300 text-white"
          }`}
        >
          Adisyon Aktar
        </button>
      </div>
    </div>
  );
}
