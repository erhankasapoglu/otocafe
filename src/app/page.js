"use client";
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

async function fetchPaymentStats() {
  const res = await fetch("/api/payment-stats");
  if (!res.ok) {
    throw new Error("İstatistikler çekilirken hata oluştu!");
  }
  return res.json();
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    todayTotal: 0,
    openOrdersTotal: 0,
    guestCount: 0,
    methodTotals: {},
    dailyData: [],
  });

  useEffect(() => {
    loadStats();

    // Socket.IO ile gerçek zamanlı güncelleme
    const socket = io();
    socket.on("tableUpdated", ({ status }) => {
      // Açık sipariş toplamı veya misafir sayısını etkileyen durumlar
      if (["open", "paid", "closed", "canceled"].includes(status)) {
        loadStats();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function loadStats() {
    try {
      const data = await fetchPaymentStats();

      // Yalnızca "Nakit" + "Kredi Kartı" topla
      let nakitToplam = 0;
      let kartToplam = 0;
      for (const key in data.methodTotals) {
        const lower = key.toLowerCase();
        const amount = data.methodTotals[key];
        if (lower === "nakit" || lower === "cash") {
          nakitToplam += amount;
        } else if (lower === "kredi kartı" || lower === "card") {
          kartToplam += amount;
        }
      }
      data.methodTotals = {
        Nakit: nakitToplam,
        "Kredi Kartı": kartToplam,
      };

      setStats(data);
    } catch (err) {
      console.error("İstatistik yüklenirken hata:", err);
    }
  }

  // Line Chart (saatlik)
  const lineData = {
    labels: stats.dailyData.map((d) => d.hour),
    datasets: [
      {
        label: "Bugün",
        data: stats.dailyData.map((d) => d.amount),
        borderColor: "#14b8a6",
        backgroundColor: "rgba(20,184,166,0.2)",
      },
    ],
  };

  // Bar Chart (Nakit vs Kart)
  const barData = {
    labels: ["Nakit", "Kredi Kartı"],
    datasets: [
      {
        label: "Günlük Ödemeler",
        data: [
          stats.methodTotals["Nakit"] || 0,
          stats.methodTotals["Kredi Kartı"] || 0,
        ],
        backgroundColor: ["#ff92a9", "#72bef0"],
        borderColor: ["#ff92a9", "#72bef0"],
        borderWidth: 1,
      },
    ],
  };

  // Doughnut Chart (Nakit vs Kart)
  const doughnutData = {
    labels: Object.keys(stats.methodTotals),
    datasets: [
      {
        label: "Ödeme Tipleri",
        data: Object.values(stats.methodTotals),
        backgroundColor: ["#ff92a9", "#72bef0"],
        hoverOffset: 4,
      },
    ],
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4">
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {/* Bugün Alınan Ödemeler */}
        <div className="rounded shadow overflow-hidden h-16 flex">
          <div className="w-16 h-16 flex items-center justify-center bg-[#FF5151]">
            <img src="/icons/red.png" alt="Red Icon" className="h-full w-full" />
          </div>
          <div className="flex-1 bg-white flex flex-col justify-center pr-4 text-right pl-2">
            <div className="text-lg font-bold">
              ₺{stats.todayTotal.toFixed(2)}
            </div>
            <div className="text-sm text-gray-700">Bugün alınan ödemeler</div>
          </div>
        </div>

        {/* Açık Sipariş Toplamı */}
        <div className="rounded shadow overflow-hidden h-16 flex">
          <div className="w-16 h-16 flex items-center justify-center bg-[#283593]">
            <img
              src="/icons/blue.png"
              alt="Blue Icon"
              className="h-full w-full"
            />
          </div>
          <div className="flex-1 bg-white flex flex-col justify-center pr-4 text-right pl-2">
            <div className="text-lg font-bold">
              ₺{stats.openOrdersTotal.toFixed(2)}
            </div>
            <div className="text-sm text-gray-700">Açık sipariş toplamı</div>
          </div>
        </div>

        {/* Bugün Misafir Sayısı */}
        <div className="rounded shadow overflow-hidden h-16 flex">
          <div className="w-16 h-16 flex items-center justify-center bg-[#00695D]">
            <img
              src="/icons/green.png"
              alt="Green Icon"
              className="h-full w-full"
            />
          </div>
          <div className="flex-1 bg-white flex flex-col justify-center pr-4 text-right pl-2">
            <div className="text-lg font-bold">{stats.guestCount}</div>
            <div className="text-sm text-gray-700">Bugün misafir sayısı</div>
          </div>
        </div>
      </div>

      {/* Grafikler */}
      <div className="bg-white rounded shadow p-4 mb-4 h-64 flex items-center justify-center">
        <Line
          data={lineData}
          options={{ responsive: true, plugins: { legend: { position: "top" } } }}
        />
      </div>

      <div className="bg-white rounded shadow p-4 mb-4 h-64 flex items-center justify-center">
        <Bar
          data={barData}
          options={{
            responsive: true,
            plugins: { legend: { position: "top" } },
            scales: { y: { beginAtZero: true } },
          }}
        />
      </div>

      <div className="bg-white rounded shadow p-4 h-64 flex items-center justify-center">
        <Doughnut
          data={doughnutData}
          options={{ responsive: true, plugins: { legend: { position: "bottom" } } }}
        />
      </div>
    </div>
  );
}
