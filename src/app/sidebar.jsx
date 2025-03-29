// src/app/sidebar.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Sidebar({ children }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  function handleHover(route) {
    router.prefetch(route);
  }
  function handleClick(route) {
    router.push(route);
    setOpen(false);
  }

  return (
    <div className="relative min-h-screen bg-white">
      {/* Üst Bar */}
      <header className="bg-[#003362] text-white p-2 flex items-center">
        <button onClick={() => setOpen(!open)} className="mr-2 text-2xl p-2">
          ☰
        </button>
        <div className="flex-1 flex justify-center">
          <img
            src="/icons/cafein.png"
            alt="Cafein"
            className="h-13 w-auto object-contain"
          />
        </div>
      </header>

      {/* Sayfa İçeriği */}
      <main>{children}</main>

      {/* Soldan açılan sidebar */}
      <div
        className={`
          fixed top-0 left-0
          w-64 h-screen
          transform transition-transform duration-300 z-50
          ${open ? "translate-x-0" : "-translate-x-full"}
          flex flex-col
        `}
      >
        {/* Üst Mavi Kısım */}
        <div className="bg-[#003362] text-white p-4">
          <button onClick={() => setOpen(false)} className="mb-2 text-xl">
            X
          </button>
        </div>

        {/* Menü Alanı (Beyaz) */}
        <div className="flex-1 bg-white text-black p-4 overflow-y-auto">
          {/* Anasayfa */}
          <button
            onMouseEnter={() => handleHover("/")}
            onClick={() => handleClick("/")}
            className="flex items-center p-2 hover:bg-gray-200 rounded"
          >
            <img src="/icons/ev.png" alt="Anasayfa" className="w-6 h-6 mr-2" />
            <span>Anasayfa</span>
          </button>

          {/* Masalar */}
          <button
            onMouseEnter={() => handleHover("/orders")}
            onClick={() => handleClick("/orders")}
            className="flex items-center p-2 hover:bg-gray-200 rounded"
          >
            <img
              src="/icons/tables.png"
              alt="Masalar"
              className="w-6 h-6 mr-2"
            />
            <span>Masalar</span>
          </button>

          {/* Masa Yönetimi */}
          <button
            onMouseEnter={() => handleHover("/tables")}
            onClick={() => handleClick("/tables")}
            className="flex items-center p-2 hover:bg-gray-200 rounded"
          >
            <img src="/icons/tset.png" alt="Masa Yön." className="w-6 h-6 mr-2" />
            <span>Masa Yönetimi</span>
          </button>

          {/* Ürün Yönetimi */}
          <button
            onMouseEnter={() => handleHover("/products")}
            onClick={() => handleClick("/products")}
            className="flex items-center p-2 hover:bg-gray-200 rounded"
          >
            <img
              src="/icons/urunyon.png"
              alt="Ürün Yönetimi"
              className="w-6 h-6 mr-2"
            />
            <span>Ürün Yönetimi</span>
          </button>

          {/* Stok Yönetimi */}
          <button
            onMouseEnter={() => handleHover("/stock")}
            onClick={() => handleClick("/stock")}
            className="flex items-center p-2 hover:bg-gray-200 rounded"
          >
            <img src="/icons/stok.png" alt="Stok Yönetimi" className="w-6 h-6 mr-2" />
            <span>Stok Yönetimi</span>
          </button>

          {/* Gider Yönetimi */}
          <button
            onMouseEnter={() => handleHover("/gider")}
            onClick={() => handleClick("/gider")}
            className="flex items-center p-2 hover:bg-gray-200 rounded"
          >
            <img src="/icons/gider.png" alt="Gider Yönetimi" className="w-6 h-6 mr-2" />
            <span>Gider Yönetimi</span>
          </button>

          {/* İstatistikler (Alt Menü) */}
          <div>
            <button
              onClick={() => setStatsOpen(!statsOpen)}
              className="flex items-center p-2 hover:bg-gray-200 rounded w-full text-left"
            >
              <img
                src="/icons/stats.png"
                alt="İstatistikler"
                className="w-6 h-6 mr-2"
              />
              <span>İstatistikler</span>
              {/* Ok ikonu: Yukarı (▲) veya Aşağı (▼) */}
              <span className="ml-auto text-sm">
                {statsOpen ? "▲" : "▼"}
              </span>
            </button>
            {statsOpen && (
              <div className="pl-8 flex flex-col gap-1 mt-1">
                <button
                  onMouseEnter={() => handleHover("/statistics/paid")}
                  onClick={() => handleClick("/statistics/paid")}
                  className="flex items-center p-1 hover:bg-gray-200 rounded"
                >
                  <img
                    src="/icons/rep.png"
                    alt="Ödeme Raporları"
                    className="w-5 h-5 mr-2"
                  />
                  <span>Ödeme Raporları</span>
                </button>
                <button
                  onMouseEnter={() => handleHover("/statistics/canceled")}
                  onClick={() => handleClick("/statistics/canceled")}
                  className="flex items-center p-1 hover:bg-gray-200 rounded"
                >
                  <img
                    src="/icons/cancel.png"
                    alt="İptal Edilenler"
                    className="w-5 h-5 mr-2"
                  />
                  <span>İptal Edilenler</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arkada karartı (menü açıksa) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
