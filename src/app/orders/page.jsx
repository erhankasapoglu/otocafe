"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export default function OrdersPage() {
  const router = useRouter();

  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [tables, setTables] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Ödeme modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTableIndex, setSelectedTableIndex] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentType, setPaymentType] = useState("full");

  // Menü (3 nokta)
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);

  // Socket.IO
  const socketRef = useRef(null);
  const [updates, setUpdates] = useState([]);

  // ----------------------------------------------------------------
  // 1) MASALARI + SESSIONS YÜKLE ( artık `data` döndürüyor )
  // ----------------------------------------------------------------
  const loadTablesForRegion = useCallback(async (regionId) => {
    try {
      const res = await fetch(
        `/api/region-tables-and-sessions?regionId=${regionId}`
      );
      if (!res.ok) throw new Error("Masalar yüklenirken hata oluştu.");
      const data = await res.json();

      setTables(data.tables);

      // items.length === 0 olan session'ları null kabul et
      const sArr = data.tables.map((t) => {
        let s = data.sessionMap[t.id] || null;
        if (s && Array.isArray(s.items) && s.items.length === 0) {
          s = null;
        }
        return s;
      });
      setSessions(sArr);

      return data;
    } catch (error) {
      console.error("Masalar yüklenirken hata:", error);
      return { tables: [], sessionMap: {} };
    }
  }, []);

  // ----------------------------------------------------------------
  // 2) İLK YÜKLEME ( bölgeleri al ve openCount hesapla )
  // ----------------------------------------------------------------
  async function loadInitialData() {
    try {
      const res = await fetch("/api/regions");
      if (!res.ok) throw new Error("Bölgeler yüklenirken hata oluştu.");
      const regionsData = await res.json();

      // Her bölge için openCount hesapla
      const regionsWithCount = await Promise.all(
        regionsData.map(async (r) => {
          const resp = await fetch(
            `/api/region-tables-and-sessions?regionId=${r.id}`
          );
          const { sessionMap } = await resp.json();
          const openCount = Object.values(sessionMap).filter(
            (s) => s?.items?.length > 0
          ).length;
          return { ...r, openCount };
        })
      );
      setRegions(regionsWithCount);

      // İlk bölgeyi seç ve masaları yükle
      if (regionsWithCount.length > 0) {
        setSelectedRegion(regionsWithCount[0].id);
        await loadTablesForRegion(regionsWithCount[0].id);
      }
    } catch (error) {
      console.error("Initial data hata:", error);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [loadTablesForRegion]);

  // ----------------------------------------------------------------
  // 3) SOCKET.IO İLE GERÇEK ZAMANLI GÜNCELLEMELER
  // ----------------------------------------------------------------
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("tableUpdated", (data) => {
      setUpdates((prev) => [...prev, data]);

      if (data.status === "open") {
        if (selectedRegion) loadTablesForRegion(selectedRegion);
        return;
      }

      setSessions((prev) =>
        prev.map((session) => {
          if (session && session.id === data.sessionId) {
            if (["paid", "canceled", "closed"].includes(data.status)) {
              return null;
            }
            return {
              ...session,
              status: data.status,
              total: data.total ?? session.total,
            };
          }
          return session;
        })
      );
    });

    return () => socket.disconnect();
  }, [selectedRegion, loadTablesForRegion]);

  // ----------------------------------------------------------------
  // 4) BÖLGE SEKME TIKLAMA
  // ----------------------------------------------------------------
  async function handleRegionTabClick(regionId) {
    setSelectedRegion(regionId);

    const data = await loadTablesForRegion(regionId);

    // Yeni openCount’u güncelle
    const openCount = Object.values(data.sessionMap).filter(
      (s) => s?.items?.length > 0
    ).length;
    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, openCount } : r
      )
    );

    setShowPaymentModal(false);
    setMenuOpenIndex(null);
  }

  // ----------------------------------------------------------------
  // 5) MASAYA TIKLAYINCA OTURUM AÇMA
  // ----------------------------------------------------------------
  async function handleTableClick(i) {
    const t = tables[i];
    if (!selectedRegion) return;

    try {
      const res = await fetch("/api/open-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: selectedRegion,
          tableId: t.tableId,
        }),
      });
      if (!res.ok) {
        console.error("Masa açma hatası:", await res.text());
        return;
      }
      const session = await res.json();

      setSessions((prev) => {
        const copy = [...prev];
        copy[i] = session;
        return copy;
      });
      setSelectedTableIndex(i);

      router.push(
        `/tables/${t.id}?regionId=${selectedRegion}&sessionId=${session.id}`
      );
    } catch (err) {
      console.error("Masa açma hatası:", err);
    }
  }

  // ----------------------------------------------------------------
  // 6) MASA İPTAL
  // ----------------------------------------------------------------
  async function handleCancelTable(i) {
    const s = sessions[i];
    if (!s) return;

    await fetch("/api/cancel-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: s.id }),
    });

    setSessions((prev) => {
      const copy = [...prev];
      copy[i] = null;
      return copy;
    });
    setMenuOpenIndex(null);

    // İptal sonrası sekme sayısını düş
    setRegions((prev) =>
      prev.map((r) =>
        r.id === selectedRegion
          ? { ...r, openCount: Math.max((r.openCount || 1) - 1, 0) }
          : r
      )
    );
  }

  // ----------------------------------------------------------------
  // 7) MENÜ AÇ / KAPAT
  // ----------------------------------------------------------------
  function openMenuSheet(e, i) {
    e.stopPropagation();
    setMenuOpenIndex(i);
  }
  function closeMenuSheet() {
    setMenuOpenIndex(null);
  }

  // ----------------------------------------------------------------
  // 8) ÖDEME MODALLARI
  // ----------------------------------------------------------------
  function handlePaymentModal(i) {
    setSelectedTableIndex(i);
    setPaymentMethod("cash");
    setPaymentType("full");
    setShowPaymentModal(true);
    setMenuOpenIndex(null);
  }
  function handlePartialPaymentModal(i) {
    setSelectedTableIndex(i);
    setPaymentMethod("cash");
    setPaymentType("partial");
    setShowPaymentModal(true);
    setMenuOpenIndex(null);
  }

  // ----------------------------------------------------------------
  // 9) ÖDEME ONAY
  // ----------------------------------------------------------------
  async function handleConfirmPayment() {
    const s = sessions[selectedTableIndex];
    if (!s) return;

    if (paymentType === "full") {
      await fetch("/api/pay-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: s.id, paymentMethod }),
      });
    } else {
      const sumPaid = s.payments
        ? s.payments.reduce((acc, pay) => acc + pay.amount, 0)
        : 0;
      const remaining = s.total - sumPaid;
      if (remaining <= 0) {
        alert("Bu masada ödenecek bakiye kalmadı.");
        return;
      }
      await fetch("/api/partial-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: s.id,
          method: paymentMethod,
          amount: remaining,
        }),
      });
    }

    setSessions((prev) => {
      const copy = [...prev];
      copy[selectedTableIndex] = null;
      return copy;
    });
    setShowPaymentModal(false);

    // Ödeme sonrası sekme sayısını düş
    setRegions((prev) =>
      prev.map((r) =>
        r.id === selectedRegion
          ? { ...r, openCount: Math.max((r.openCount || 1) - 1, 0) }
          : r
      )
    );
  }

  // ----------------------------------------------------------------
  // 10–11) Masayı değiştir, birleştir, adisyon aktar
  // ----------------------------------------------------------------
  function handleChangeTable() {
    const s = sessions[menuOpenIndex];
    if (!s) return;
    router.push(`/changetable?sessionId=${s.id}`);
    closeMenuSheet();
  }
  function handleMergeTable() {
    const s = sessions[menuOpenIndex];
    if (!s) return;
    router.push(`/mergetable?sessionId=${s.id}`);
    closeMenuSheet();
  }
  function handleTransferAdisyon() {
    const s = sessions[menuOpenIndex];
    if (!s) return;
    router.push(`/transferadisyon?sourceSessionId=${s.id}`);
    closeMenuSheet();
  }

  // ----------------------------------------------------------------
  // 12) Label & birleştirme için hesaplama
  // ----------------------------------------------------------------
  let sessionLabelMap = {};
  let labelCounter = 1;
  const occurrenceMap = {};
  sessions.forEach((s) => {
    if (s) occurrenceMap[s.id] = (occurrenceMap[s.id] || 0) + 1;
  });
  sessions.forEach((s) => {
    if (s && !sessionLabelMap[s.id]) {
      sessionLabelMap[s.id] = labelCounter++;
    }
  });

  // ----------------------------------------------------------------
  // 13) RENDER
  // ----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* BÖLGE SEKME LİSTESİ */}
      <div className="flex border-b border-gray-300 bg-white overflow-x-auto">
        {regions.map((r) => {
          const isActive = selectedRegion === r.id;
          return (
            <button
              key={r.id}
              onClick={() => handleRegionTabClick(r.id)}
              className={`flex-1 text-center py-3 font-semibold transition-colors ${
                isActive
                  ? "text-red-600 border-b-2 border-red-600"
                  : "text-gray-600"
              }`}
            >
              {r.name}
              {r.openCount > 0 && ` (${r.openCount})`}
            </button>
          );
        })}
      </div>

      {/* MASALAR */}
      <div className="p-4 grid grid-cols-3 grid-rows-8 gap-4">
        {tables.map((table, i) => {
          const session = sessions[i];
          if (!session) {
            // Masa boş
            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(i)}
                className="relative rounded-md border border-gray-300 bg-white cursor-pointer text-center aspect-[2/1] flex flex-col items-center justify-center"
              >
                <div className="font-bold text-gray-700">
                  {table.alias || `Masa ${table.tableId}`}
                </div>
              </div>
            );
          }

          // Session varsa
          const sumPaid = session.payments
            ? session.payments.reduce((acc, pay) => acc + pay.amount, 0)
            : 0;
          const total = session.total;
          const remaining = Math.max(total - sumPaid, 0);

          let containerClass = `
            relative rounded-md border border-gray-300 bg-white cursor-pointer text-center aspect-[2/1]
            flex flex-col items-center justify-center
          `;
          if (session.status === "open") containerClass += " border-red-500 border-2";
          else if (session.status === "paid") containerClass += " bg-blue-100";
          else if (session.status === "canceled") containerClass += " bg-gray-200";

          const label = sessionLabelMap[session.id] || null;
          const howMany = occurrenceMap[session.id] || 1;

          return (
            <div
              key={table.id}
              onClick={() =>
                session.status === "open" && handleTableClick(i)
              }
              className={containerClass}
            >
              <div className="font-bold text-gray-700">
                {table.alias || `Masa ${table.tableId}`}
              </div>
              <div className="text-sm text-gray-600 mt-0">
                {sumPaid === 0
                  ? `${total} TL`
                  : `${sumPaid} / ${total} TL (Kalan: ${remaining})`}
              </div>
              {howMany > 1 && (

                <div className="absolute bottom-2 left-2 text-xs font-bold bg-yellow-200 rounded-full px-2 py-1">
                  {label}
                </div>
              )}
              {session.status === "open" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenIndex(i);
                  }}
                  className="absolute top-2 right-2 text-gray-500 text-xl"
                >
                  &#8942;
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* BOTTOM SHEET MENÜ */}
      {menuOpenIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 transition-all duration-500"
          onClick={closeMenuSheet}
        >
          <div
            className="bg-white rounded-t-xl p-4 transform transition-transform duration-500 translate-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              {(() => {
                const s = sessions[menuOpenIndex];
                if (!s) return null;
                const sumPaid = s.payments
                  ? s.payments.reduce((a, p) => a + p.amount, 0)
                  : 0;
                const remaining = Math.max(s.total - sumPaid, 0);
                return (
                  <>
                    <button
                      onClick={() => handlePartialPaymentModal(menuOpenIndex)}
                      className="text-left px-2 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                    >
                      <img
                        src="/icons/hizliode.png"
                        alt="Quick Pay"
                        className="w-8 h-8"
                      />
                      {`Hızlı Öde (${remaining} ₺)`}
                    </button>
                    <button
                      onClick={() => handleCancelTable(menuOpenIndex)}
                      className="text-left px-2 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                    >
                      <img
                        src="/icons/iptal.png"
                        alt="Cancel Table"
                        className="w-8 h-8"
                      />
                      Masa İptal
                    </button>
                  </>
                );
              })()}
              <button
                onClick={handleChangeTable}
                className="text-left px-2 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <img
                  src="/icons/masadeg.png"
                  alt="Change Table"
                  className="w-8 h-8"
                />
                Masayı Değiştir
              </button>
              <button
                onClick={handleMergeTable}
                className="text-left px-2 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <img
                  src="/icons/masabir.png"
                  alt="Merge Table"
                  className="w-8 h-8"
                />
                Masaları Birleştir
              </button>
              <button
                onClick={handleTransferAdisyon}
                className="text-left px-2 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <img
                  src="/icons/aktar.png"
                  alt="Transfer Check"
                  className="w-8 h-8"
                />
                Adisyon Aktar
              </button>
              <button
                onClick={closeMenuSheet}
                className="text-left px-2 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <img
                  src="/icons/vazgec.png"
                  alt="Dismiss"
                  className="w-8 h-8"
                />
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÖDEME MODAL */}
      {showPaymentModal && selectedTableIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow w-80">
            <h2 className="text-xl font-bold mb-4 text-center">
              Masa {tables[selectedTableIndex].tableId} Ödeme
            </h2>
            <div className="flex gap-4 justify-center mb-6">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`w-24 h-24 flex flex-col items-center justify-center rounded border-2 transition-colors font-bold ${
                  paymentMethod === "cash"
                    ? "bg-[#ffc9c9] border-black text-black"
                    : "bg-white border-gray-300 text-black"
                }`}
              >
                <img
                  src="/icons/cash.png"
                  alt="Cash"
                  className="w-16 h-16 mb-1"
                />
                Nakit
              </button>
              <button
                onClick={() => setPaymentMethod("card")}
                className={`w-24 h-24 flex flex-col items-center justify-center rounded border-2 transition-colors font-bold ${
                  paymentMethod === "card"
                    ? "bg-[#ffc9c9] border-black text-black"
                    : "bg-white border-gray-300 text-black"
                }`}
              >
                <img
                  src="/icons/card.png"
                  alt="Card"
                  className="w-16 h-16 mb-1"
                />
                Kart
              </button>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-300 rounded font-bold"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmPayment}
                className="px-4 py-2 bg-blue-500 text-white rounded font-bold"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
