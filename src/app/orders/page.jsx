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
  // 1) MASALARI + SESSIONS YÜKLE
  // ----------------------------------------------------------------
  const loadTablesForRegion = useCallback(async (regionId) => {
    try {
      const res = await fetch(`/api/region-tables-and-sessions?regionId=${regionId}`);
      if (!res.ok) throw new Error("Masalar yüklenirken hata oluştu.");
      const data = await res.json();

      setTables(data.tables);

      // sessions dizisi, tablodaki her index'e karşılık gelecek şekilde
      // data.sessionMap içindeki verileri eşliyor (boşsa null).
      const sArr = data.tables.map((t) => {
        let s = data.sessionMap[t.id] || null;
        if (s && s.items && s.items.length === 0) {
          // items 0'sa session'ı null kabul ediyoruz
          s = null;
        }
        return s;
      });
      setSessions(sArr);
    } catch (error) {
      console.error("Masalar yüklenirken hata:", error);
    }
  }, []);

  // ----------------------------------------------------------------
  // 2) İLK YÜKLEME
  // ----------------------------------------------------------------
  async function loadInitialData() {
    try {
      const res = await fetch("/api/regions");
      if (!res.ok) throw new Error("Bölgeler yüklenirken hata oluştu.");
      const regionsData = await res.json();
      setRegions(regionsData);

      if (regionsData.length > 0) {
        setSelectedRegion(regionsData[0].id);
        await loadTablesForRegion(regionsData[0].id);
      }
    } catch (error) {
      console.error("Initial data hata:", error);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [loadTablesForRegion]);

  // ----------------------------------------------------------------
  // 3) SOCKET.IO
  // ----------------------------------------------------------------
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("tableUpdated", (data) => {
      console.log("Gelen güncelleme:", data);
      setUpdates((prev) => [...prev, data]);

      // Eğer status "open" ise, masayı yenilemek için tabloyu tekrar yükle
      if (data.status === "open") {
        if (selectedRegion) {
          loadTablesForRegion(selectedRegion);
        }
        return;
      }

      // Aksi halde sessions dizisinde ilgili session'ı güncelle
      setSessions((prev) =>
        prev.map((session) => {
          if (session && session.id === data.sessionId) {
            // paid, canceled, closed durumlarında session'ı null yap
            if (["paid", "canceled", "closed"].includes(data.status)) {
              return null;
            }
            // open durumunda session güncelle
            else if (data.status === "open") {
              return {
                ...session,
                status: "open",
                total: data.total ?? session.total,
              };
            }
          }
          return session;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedRegion, loadTablesForRegion]);

  // ----------------------------------------------------------------
  // 4) BÖLGE SEKME
  // ----------------------------------------------------------------
  async function handleRegionTabClick(regionId) {
    setSelectedRegion(regionId);
    await loadTablesForRegion(regionId);
    setShowPaymentModal(false);
    setMenuOpenIndex(null);
  }

  // ----------------------------------------------------------------
  // 5) MASAYA TIKLAYINCA OPEN
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

      // Masa açıldıktan sonra tables/[id] sayfasına yönlendir
      router.push(`/tables/${t.id}?regionId=${selectedRegion}&sessionId=${session.id}`);
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
  }

  // ----------------------------------------------------------------
  // 7) MENÜ (3 nokta)
  // ----------------------------------------------------------------
  function openMenuSheet(e, i) {
    e.stopPropagation();
    setMenuOpenIndex(i);
  }
  function closeMenuSheet() {
    setMenuOpenIndex(null);
  }

  // ----------------------------------------------------------------
  // 8) ÖDEME MODAL
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

  async function handleConfirmPayment() {
    const s = sessions[selectedTableIndex];
    if (!s) return;

    // Full Payment
    if (paymentType === "full") {
      await fetch("/api/pay-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: s.id,
          paymentMethod,
        }),
      });
    }
    // Partial Payment
    else {
      const sumPaid = s.payments ? s.payments.reduce((acc, pay) => acc + pay.amount, 0) : 0;
      const remaining = s.total - sumPaid;
      if (remaining <= 0) {
        alert("Bu masada ödenecek bir tutar kalmadı.");
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

    // Ödeme sonrası session null
    setSessions((prev) => {
      const copy = [...prev];
      copy[selectedTableIndex] = null;
      return copy;
    });
    setShowPaymentModal(false);
  }

  // ----------------------------------------------------------------
  // 9) MASAYI DEĞİŞTİR (Yeni Sayfaya Yönlendirme)
  // ----------------------------------------------------------------
  function handleChangeTable() {
    const s = sessions[menuOpenIndex];
    if (!s) return;
    router.push(`/changetable?sessionId=${s.id}`);
    closeMenuSheet();
  }

  // ----------------------------------------------------------------
  // 10) MASALARI BİRLEŞTİR (Yeni Sayfaya Yönlendirme)
  // ----------------------------------------------------------------
  function handleMergeTable() {
    const s = sessions[menuOpenIndex];
    if (!s) return;
    router.push(`/mergetable?sessionId=${s.id}`);
    closeMenuSheet();
  }

  // ----------------------------------------------------------------
  // 11) ADİSYON AKTAR (Yeni sayfaya yönlendirme, sourceSessionId query parametresi ile)
  // ----------------------------------------------------------------
  function handleTransferAdisyon() {
    const s = sessions[menuOpenIndex];
    if (!s) return;
    router.push(`/transferadisyon?sourceSessionId=${s.id}`);
    closeMenuSheet();
  }

  // ----------------------------------------------------------------
  // [EKLENDİ: label mantığı + sadece multiple masalar için gösterim]
  // 1) sessionLabelMap: her session.id için bir label ver
  // 2) ama sadece bir session.id birden fazla kez geçiyorsa (birleştirilmiş) ekranda göster
  // ----------------------------------------------------------------
  let sessionLabelMap = {};
  let labelCounter = 1;

  // (A) sessionId -> kaç defa tekrar ediyor?
  const occurrenceMap = {};
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (!s) continue;
    if (!occurrenceMap[s.id]) occurrenceMap[s.id] = 0;
    occurrenceMap[s.id]++;
  }

  // (B) Olası sessionId’lere label atayalım
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (s) {
      if (!sessionLabelMap[s.id]) {
        sessionLabelMap[s.id] = labelCounter;
        labelCounter++;
      }
    }
  }

  // ----------------------------------------------------------------
  // 12) RENDER
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
                className="relative rounded-md border border-gray-300 bg-white
                           cursor-pointer text-center aspect-[2/1]
                           flex flex-col items-center justify-center"
              >
                <div className="font-bold text-gray-700">
                  {table.alias ? table.alias : `Masa ${table.tableId}`}
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
            relative
            rounded-md
            border border-gray-300
            bg-white
            cursor-pointer
            text-center
            aspect-[2/1]
            flex
            flex-col
            items-center
            justify-center
          `;
          if (session.status === "open") {
            containerClass += " border-red-500 border-2";
          } else if (session.status === "paid") {
            containerClass += " bg-blue-100";
          } else if (session.status === "canceled") {
            containerClass += " bg-gray-200";
          }

          // Label bul
          const label = sessionLabelMap[session.id] || null;
          // Kaç masa var bu session'da?
          const howMany = occurrenceMap[session.id] || 1;

          return (
            <div
              key={table.id}
              onClick={() => {
                if (session.status === "open") {
                  handleTableClick(i);
                }
              }}
              className={containerClass}
            >
              <div className="font-bold text-gray-700">
                {table.alias ? table.alias : `Masa ${table.tableId}`}
              </div>
              <div className="text-sm text-gray-600 mt-0">
                {sumPaid === 0
                  ? `${total} TL`
                  : `${sumPaid} / ${total} TL (Kalan: ${remaining})`}
              </div>

              {/* Sadece howMany > 1 ise (yani bu session en az 2 masa içeriyorsa) label göster */}
              {howMany > 1 && (
                <div
                  className="absolute bottom-2 left-2
                             text-xs font-bold
                             bg-yellow-200
                             rounded-full
                             px-2 py-1"
                >
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
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50
                     transition-all duration-500"
          onClick={closeMenuSheet}
        >
          <div
            className="bg-white rounded-t-xl p-4 transform transition-transform
                       duration-500 translate-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              {(() => {
                const s = sessions[menuOpenIndex];
                if (!s) return null;

                const sumPaid = s.payments
                  ? s.payments.reduce((acc, pay) => acc + pay.amount, 0)
                  : 0;
                const remaining = Math.max(s.total - sumPaid, 0);

                return (
                  <>
                    {/* Quick Pay */}
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

                    {/* Cancel Table */}
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

              {/* Change Table */}
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

              {/* Merge Table */}
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

              {/* Transfer Check (Adisyon Aktar) */}
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

              {/* Dismiss (Vazgeç) */}
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

            {/* İKONLU BUTONLAR */}
            <div className="flex gap-4 justify-center mb-6">
              {/* Nakit Butonu (cash) */}
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`w-24 h-24 flex flex-col items-center justify-center rounded border-2 transition-colors font-bold
                  ${
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
                <span className="font-bold">Nakit</span>
              </button>

              {/* Kart Butonu (card) */}
              <button
                onClick={() => setPaymentMethod("card")}
                className={`w-24 h-24 flex flex-col items-center justify-center rounded border-2 transition-colors font-bold
                  ${
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
                <span className="font-bold">Kart</span>
              </button>
            </div>

            {/* Onay / İptal Butonları */}
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
