"use client";
import React, { useState, useEffect } from "react";

export default function GiderPage() {
  const [expenseCategoryName, setExpenseCategoryName] = useState("");
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [newExpense, setNewExpense] = useState({});

  // Kategorilere ait "Son 5 gideri göster/gizle" durumları
  const [showLast5Map, setShowLast5Map] = useState({});

  // Modal onayı için state:
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmCatId, setConfirmCatId] = useState(null);
  const [confirmAmount, setConfirmAmount] = useState(null);

  // Sayfa yüklendiğinde gider kategorilerini yükleyelim
  useEffect(() => {
    fetchExpenseCategories();
  }, []);

  async function fetchExpenseCategories() {
    try {
      const res = await fetch("/api/expense-categories");
      if (!res.ok) {
        throw new Error("Gider kategorileri alınamadı");
      }
      const data = await res.json();
      setExpenseCategories(data);
    } catch (error) {
      console.error("Hata:", error.message);
    }
  }

  async function handleAddExpenseCategory(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: expenseCategoryName }),
      });
      if (!res.ok) {
        throw new Error("Yeni gider kategorisi eklenemedi");
      }
      setExpenseCategoryName("");
      await fetchExpenseCategories();
    } catch (error) {
      console.error("Hata:", error.message);
    }
  }

  // 1) Form onSubmit --> sadece modal açıyoruz
  function handleAddExpenseRequest(e, expenseCategoryId) {
    e.preventDefault();
    const amount = parseFloat(newExpense[expenseCategoryId]);
    if (isNaN(amount)) {
      alert("Lütfen geçerli bir tutar girin");
      return;
    }
    // Modal için gerekli verileri kaydedip modalı aç
    setConfirmCatId(expenseCategoryId);
    setConfirmAmount(amount);
    setShowConfirmModal(true);
  }

  // 2) Kullanıcı “Evet” derse asıl eklemeyi yapan fonksiyon
  async function doAddExpense() {
    try {
      // confirmCatId / confirmAmount state'lerinden tutar ve kategori id'sini al
      const expenseCategoryId = confirmCatId;
      const amount = confirmAmount;

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Yeni Gider",
          amount,
          expenseCategoryId,
        }),
      });
      if (!res.ok) {
        throw new Error("Gider eklenemedi");
      }
      // Girdi alanını temizle
      setNewExpense((prev) => ({ ...prev, [expenseCategoryId]: "" }));
      // Listeyi güncelle
      await fetchExpenseCategories();
    } catch (error) {
      console.error("Hata:", error.message);
    } finally {
      // Modalı kapat
      setShowConfirmModal(false);
      setConfirmCatId(null);
      setConfirmAmount(null);
    }
  }

  function toggleLast5(catId) {
    setShowLast5Map((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  }

  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "16px",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "24px" }}>
        Gider Yönetimi
      </h1>

      {/* Yeni Gider Kategorisi Ekleme Alanı */}
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
          backgroundColor: "#f9f9f9",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Yeni Gider Kalemi Ekle</h2>
        <form
          onSubmit={handleAddExpenseCategory}
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          <label style={{ fontWeight: "500" }}>
            Gider Kalemi Adı:
            <input
              type="text"
              value={expenseCategoryName}
              onChange={(e) => setExpenseCategoryName(e.target.value)}
              required
              style={{
                marginLeft: "8px",
                padding: "6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                width: "100%",
                maxWidth: "200px",
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              alignSelf: "start",
              padding: "8px 12px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#008cff",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Gider Kalemi Ekle
          </button>
        </form>
      </div>

      {/* Gider Kategorileri Listesi */}
      <h2 style={{ marginBottom: "12px" }}>Gider Kategorileri</h2>
      {expenseCategories.length === 0 && (
        <p style={{ fontStyle: "italic", color: "#666" }}>
          Hiç gider kategorisi eklenmemiş.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {expenseCategories.map((cat) => {
          // Bu kategorideki tüm giderler (tarihe göre en yeni üste)
          const sortedExpenses = (cat.expenses || []).sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );

          // Sadece son 5 tanesi
          const last5 = sortedExpenses.slice(0, 5);

          return (
            <div
              key={cat.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "16px",
                backgroundColor: "#fff",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "8px" }}>{cat.name}</h3>

              {/* Son 5 Gideri Göster/Gizle Butonu */}
              <button
                onClick={() => toggleLast5(cat.id)}
                style={{
                  marginBottom: "8px",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#ff9800",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Son 5 Gideri Göster/Gizle
              </button>

              {/* "Son 5 Gider" Kutusu (scrollable) */}
              {showLast5Map[cat.id] && (
                <div
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    padding: "8px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    marginBottom: "8px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  {last5.length === 0 ? (
                    <p style={{ fontStyle: "italic", color: "#666" }}>
                      Henüz gider eklenmemiş.
                    </p>
                  ) : (
                    <ul style={{ marginTop: 0, paddingLeft: "16px" }}>
                      {last5.map((exp) => (
                        <li key={exp.id} style={{ marginBottom: "4px" }}>
                          <strong>{exp.amount} TL</strong> –{" "}
                          {exp.name || "Açıklama Yok"} –{" "}
                          {new Date(exp.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Gider Ekleme Formu */}
              <form
                onSubmit={(e) => handleAddExpenseRequest(e, cat.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <label style={{ fontWeight: "500" }}>
                  Gider Tutarı:
                  <input
                    type="number"
                    step="0.01"
                    value={newExpense[cat.id] || ""}
                    onChange={(e) =>
                      setNewExpense((prev) => ({
                        ...prev,
                        [cat.id]: e.target.value,
                      }))
                    }
                    required
                    style={{
                      marginLeft: "8px",
                      padding: "6px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      width: "100%",
                      maxWidth: "120px",
                    }}
                  />
                </label>
                <button
                  type="submit"
                  style={{
                    alignSelf: "start",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: "#00c853",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Gider Ekle
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* Modal: Onay (Evet/Hayır) */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "16px",
              borderRadius: "8px",
              maxWidth: "320px",
              width: "100%",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "16px" }}>
              {confirmAmount} TL eklemek istediğinize emin misiniz?
            </h2>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                Hayır
              </button>
              <button
                onClick={doAddExpense}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#00c853",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Evet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
