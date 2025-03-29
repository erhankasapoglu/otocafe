"use client";
import React, { useState, useEffect } from "react";

// Chart.js importları
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// ChartJS’i kaydet
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// 1) "cash" -> "Nakit", "card" -> "Kart" gibi dönüştürmek için basit bir tablo
const methodNameMap = {
  cash: "Nakit",
  card: "Kart",
};

function transformMethodTotals(original) {
  // Örn: original = { cash: 500, card: 300, ... }
  // Dönüşte => { Nakit: 500, Kart: 300, ... }
  const result = {};
  for (const key in original) {
    const lowerKey = key.toLowerCase();
    // Dönüştürme tablosu, yoksa orijinal key
    const newKey = methodNameMap[lowerKey] || key;
    const value = original[key];
    // Aynı isim tekrar çıkarsa topluyoruz (örneğin hem "cash" hem "Cash" gelirse)
    result[newKey] = (result[newKey] || 0) + value;
  }
  return result;
}

export default function PaidStatsPage() {
  const [rangeOption, setRangeOption] = useState("today"); 
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ödeme / gider istatistikleri
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [methodTotals, setMethodTotals] = useState({});
  const [expenseTotal, setExpenseTotal] = useState(0);

  // Net kar
  const netProfit = paymentTotal - expenseTotal;

  // Yardımcı fonksiyonlar
  function pad(num) {
    return num < 10 ? "0" + num : num;
  }
  function toYMD(dateObj) {
    const yy = dateObj.getFullYear();
    const mm = dateObj.getMonth() + 1;
    const dd = dateObj.getDate();
    return `${yy}-${pad(mm)}-${pad(dd)}`;
  }

  // rangeOption değiştiğinde otomatik tarih
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    if (rangeOption === "today") {
      const start = new Date(y, m, d, 0, 0, 0);
      const end = new Date(y, m, d, 23, 59, 59);
      setStartDate(toYMD(start));
      setEndDate(toYMD(end));
    } else if (rangeOption === "thisMonth") {
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0, 23, 59, 59);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(lastDay));
    } else if (rangeOption === "thisYear") {
      const firstDay = new Date(y, 0, 1);
      const lastDay = new Date(y, 11, 31, 23, 59, 59);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(lastDay));
    } else {
      // "custom"
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    }
  }, [rangeOption]);

  // İstatistikleri çek
  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      // 1) Ödeme verileri
      const paymentRes = await fetch(
        `/api/payment-stats-range?startDate=${startDate}&endDate=${endDate}`
      );
      if (!paymentRes.ok) {
        throw new Error("Ödeme verileri alınamadı");
      }
      const paymentData = await paymentRes.json();

      // 2) Gider verileri
      const expenseRes = await fetch(
        `/api/expense-stats-range?startDate=${startDate}&endDate=${endDate}`
      );
      if (!expenseRes.ok) {
        throw new Error("Gider verileri alınamadı");
      }
      const expenseData = await expenseRes.json();

      // "cash" -> "Nakit", "card" -> "Kart" (mapliyoruz)
      const transformed = transformMethodTotals(paymentData.methodTotals || {});

      // State'leri güncelle
      setPaymentTotal(paymentData.todayTotal || 0);
      setMethodTotals(transformed); // Artık { Nakit: xxx, Kart: yyy }
      setExpenseTotal(expenseData.totalExpense || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Şimdi front-end’te "Nakit" ve "Kart" anahtarları var
  const nakitVal = methodTotals["Nakit"] ?? 0;
  const kartVal = methodTotals["Kart"] ?? 0;

  // GRAFİK: "methodTotals" içinde "Nakit", "Kart", vs...
  // Net Kar'ı da ekleyelim
  const methodLabels = Object.keys(methodTotals); // ["Nakit", "Kart", ...]
  const methodValues = Object.values(methodTotals); 
  const chartLabels = [...methodLabels, "Net Kar"];
  const chartData = [...methodValues, netProfit];

  // Renkler
  const backgroundColors = chartLabels.map((label) => {
    const lower = label.toLowerCase();
    if (lower.includes("nakit")) {
      return "pink";
    } else if (lower.includes("kart")) {
      return "lightblue";
    } else if (lower.includes("net kar")) {
      return "lightgreen";
    }
    return "lightgray"; // Diğer yöntemler
  });

  const barData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Tutar (₺)",
        data: chartData,
        backgroundColor: backgroundColors,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Ödeme Yöntemleri ve Net Kar" },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  return (
    <div className="p-4 max-w-lg mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Ödeme &amp; Gider Raporu
      </h1>

      {/* Form alanı */}
      <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
        {/* Tarih Aralığı Seçimi */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700 mb-1">
            Tarih Aralığı:
          </label>
          <select
            value={rangeOption}
            onChange={(e) => setRangeOption(e.target.value)}
            className="border rounded p-2"
          >
            <option value="today">Bugün</option>
            <option value="thisMonth">Bu Ay</option>
            <option value="thisYear">Bu Yıl</option>
            <option value="custom">Özel</option>
          </select>
        </div>

        {/* Başlangıç Tarihi */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700 mb-1">
            Başlangıç Tarihi:
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded p-2"
            disabled={rangeOption !== "custom"}
          />
        </div>

        {/* Bitiş Tarihi */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700 mb-1">
            Bitiş Tarihi:
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded p-2"
            disabled={rangeOption !== "custom"}
          />
        </div>

        {/* "Hazırla" butonu */}
        <div className="flex items-end">
          <button
            onClick={fetchStats}
            className="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto"
          >
            Hazırla
          </button>
        </div>
      </div>

      {/* Yükleniyor / hata */}
      {loading && <p className="text-gray-600 mb-2">Yükleniyor...</p>}
      {error && <p className="text-red-600 mb-2">Hata: {error}</p>}

      {/* Sonuçlar */}
      {!loading && !error && (
        <div className="space-y-4">
          {/* Metinsel özetler */}
          <div className="bg-gray-50 border border-gray-300 p-4 rounded">
            <p className="font-medium text-gray-700 mb-1">
              Toplam Ödeme (Tümü):{" "}
              <span className="font-semibold">
                {paymentTotal.toFixed(2)} ₺
              </span>
            </p>
            <p className="font-medium text-gray-700 mb-1">
              Nakit:{" "}
              <span className="font-semibold">
                {nakitVal.toFixed(2)} ₺
              </span>
            </p>
            <p className="font-medium text-gray-700 mb-1">
              Kart:{" "}
              <span className="font-semibold">
                {kartVal.toFixed(2)} ₺
              </span>
            </p>
            <p className="font-medium text-gray-700 mb-1">
              Toplam Gider:{" "}
              <span className="font-semibold">
                {expenseTotal.toFixed(2)} ₺
              </span>
            </p>
            <p className="font-medium text-gray-700">
              Net Kar:{" "}
              <span className="font-semibold">
                {netProfit.toFixed(2)} ₺
              </span>
            </p>
          </div>

          {/* Grafiği gösteriyoruz: Nakit, Kart, Net Kar */}
          <div className="bg-white p-3 border border-gray-300 rounded">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
