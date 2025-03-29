/**************************************************************************
 * 
 * SERVER KODU – TAM HALİ + Gider Yönetimi (Expense) Endpoint’leri + 
 *               Gider Kategorisi (opsiyonel) Eklendi
 * 
 **************************************************************************/

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const next = require("next");
const { PrismaClient } = require("@prisma/client");

// Yeni eklenen dayjs modülleri
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

let io; // Socket.IO instance

/**************************************************************************
 * main()
 **************************************************************************/
async function main() {
  try {
    await app.prepare();

    const expressServer = express();
    expressServer.use(express.json());

    //
    // ---------------------------------------------------------------------
    // A. Diğer Tüm Endpoint’ler (Aynen Korundu)
    // ---------------------------------------------------------------------
    //

    //--------------------------------------------------
    // 1) GET /api/regions
    //--------------------------------------------------
    expressServer.get("/api/regions", async (req, res) => {
      try {
        const regions = await prisma.region.findMany({
          orderBy: { name: "asc" },
        });
        res.json(regions);
      } catch (error) {
        console.error("Error in /api/regions:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 2) GET /api/products
    //--------------------------------------------------
    expressServer.get("/api/products", async (req, res) => {
      try {
        const products = await prisma.product.findMany({
          orderBy: { name: "asc" },
        });
        res.json(products);
      } catch (error) {
        console.error("Error in GET /api/products:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 2B) POST /api/products
    //--------------------------------------------------
    expressServer.post("/api/products", async (req, res) => {
      try {
        const { name, price, categoryId, isFavorite } = req.body;
        if (!name || price == null) {
          return res
            .status(400)
            .json({ error: "name ve price alanları gereklidir" });
        }

        const dataObj = {
          name,
          price: parseFloat(price),
          isFavorite: !!isFavorite,
        };

        if (categoryId) {
          dataObj.category = { connect: { id: categoryId } };
        }

        const newProd = await prisma.product.create({ data: dataObj });
        res.json(newProd);
      } catch (error) {
        console.error("Error in POST /api/products:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 3) GET /api/stock-list
    //--------------------------------------------------
    expressServer.get("/api/stock-list", async (req, res) => {
      try {
        const products = await prisma.product.findMany({
          where: { inStockList: true },
          orderBy: { name: "asc" },
        });
        res.json(products);
      } catch (error) {
        console.error("Error in GET /api/stock-list:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 4) PATCH /api/products/:id/stock
    //--------------------------------------------------
    expressServer.patch("/api/products/:id/stock", async (req, res) => {
      try {
        const { stock, critical } = req.body;
        if (stock == null || critical == null) {
          return res
            .status(400)
            .json({ error: "stock ve critical alanları gereklidir" });
        }
        const updatedProduct = await prisma.product.update({
          where: { id: req.params.id },
          data: {
            stock: parseInt(stock, 10),
            critical: parseInt(critical, 10),
            inStockList: true,
          },
        });
        res.json(updatedProduct);
      } catch (error) {
        console.error("Error in PATCH /api/products/:id/stock:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 5) DELETE /api/stock-list/:id
    //--------------------------------------------------
    expressServer.delete("/api/stock-list/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedProduct = await prisma.product.update({
          where: { id },
          data: { inStockList: false },
        });
        res.json(updatedProduct);
      } catch (error) {
        console.error("Error in DELETE /api/stock-list/:id:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 6) GET /api/region-tables-and-sessions
    //--------------------------------------------------
    expressServer.get("/api/region-tables-and-sessions", async (req, res) => {
      try {
        const { regionId } = req.query;
        if (!regionId) {
          return res.status(400).json({ error: "regionId is required" });
        }

        const tables = await prisma.table.findMany({
          where: { regionId },
          orderBy: { tableId: "asc" },
        });
        const tableIds = tables.map((t) => t.id);

        const sessions = await prisma.tableSession.findMany({
          where: {
            tableIds: { hasSome: tableIds },
            status: "open",
          },
          include: {
            items: true,
            payments: true,
          },
        });

        const sessionMap = {};
        for (const s of sessions) {
          for (const tId of s.tableIds) {
            if (tableIds.includes(tId)) {
              sessionMap[tId] = s;
            }
          }
        }

        res.json({ tables, sessionMap });
      } catch (error) {
        console.error("Error in /api/region-tables-and-sessions:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 7) POST /api/open-table
    //--------------------------------------------------
    expressServer.post("/api/open-table", async (req, res) => {
      try {
        const { regionId, tableId } = req.body;
        if (!regionId || tableId == null) {
          return res
            .status(400)
            .json({ error: "regionId and tableId are required" });
        }

        const tableData = await prisma.table.findFirst({
          where: { regionId, tableId },
        });
        if (!tableData) {
          return res.status(404).json({ error: "Table not found" });
        }
        const dbTableId = tableData.id;

        let session = await prisma.tableSession.findFirst({
          where: {
            tableIds: { has: dbTableId },
            status: "open",
          },
          include: { items: true },
        });

        if (!session) {
          session = await prisma.tableSession.create({
            data: {
              tableIds: [dbTableId],
              status: "open",
              total: 0,
            },
            include: { items: true },
          });
        }

        io.emit("tableUpdated", {
          sessionId: session.id,
          status: "open",
          total: session.total,
        });

        res.json(session);
      } catch (error) {
        console.error("Error in /api/open-table:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 8) POST /api/cancel-table
    //--------------------------------------------------
    expressServer.post("/api/cancel-table", async (req, res) => {
      try {
        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId required" });
        }
        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { items: true },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        // Stok geri iade
        for (const item of session.items) {
          if (item.productId) {
            await prisma.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { status: "canceled", closedAt: new Date() },
          include: { items: true },
        });

        io.emit("tableUpdated", {
          sessionId,
          status: "canceled",
          total: updatedSession.total,
        });
        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/cancel-table:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 9) POST /api/pay-table
    //--------------------------------------------------
    expressServer.post("/api/pay-table", async (req, res) => {
      try {
        const { sessionId, paymentMethod } = req.body;
        if (!sessionId || !paymentMethod) {
          return res
            .status(400)
            .json({ error: "sessionId and paymentMethod are required" });
        }
        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }
        if (session.status !== "open") {
          return res.status(400).json({ error: "Session is not open" });
        }

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: {
            status: "paid",
            paymentMethod,
            closedAt: new Date(),
          },
          include: { items: true },
        });

        io.emit("tableUpdated", {
          sessionId: updatedSession.id,
          status: updatedSession.status,
          total: updatedSession.total,
        });
        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/pay-table:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 10) POST /api/upsert-order-items
    //--------------------------------------------------
    expressServer.post("/api/upsert-order-items", async (req, res) => {
      try {
        const { sessionId, items } = req.body;
        if (!sessionId || !items) {
          return res
            .status(400)
            .json({ error: "sessionId and items are required" });
        }

        const existingItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: sessionId },
        });

        for (const it of items) {
          const { productId, name, price, quantity } = it;
          const oldItem = existingItems.find(
            (e) => e.productId === productId
          );
          const oldQty = oldItem ? oldItem.quantity : 0;
          const diff = quantity - oldQty;

          // Stok Güncellemesi
          if (productId) {
            if (diff > 0) {
              // Miktar arttı
              await prisma.product.update({
                where: { id: productId },
                data: { stock: { decrement: diff } },
              });
            } else if (diff < 0) {
              // Miktar azaldı
              await prisma.product.update({
                where: { id: productId },
                data: { stock: { increment: Math.abs(diff) } },
              });
            }
          }

          // Ürün 0'a düştüyse sil
          if (quantity === 0) {
            await prisma.tableSessionItem.deleteMany({
              where: { tableSessionId: sessionId, productId },
            });
          } else {
            // Upsert
            await prisma.tableSessionItem.upsert({
              where: {
                tableSessionId_name: { tableSessionId: sessionId, name },
              },
              update: { price, quantity, productId },
              create: {
                tableSessionId: sessionId,
                productId,
                name,
                price,
                quantity,
              },
            });
          }
        }

        // Tüm maddeler güncellendikten sonra total hesapla
        const allItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: sessionId },
        });
        const total = allItems.reduce(
          (acc, cur) => acc + cur.price * cur.quantity,
          0
        );

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { total },
          include: { items: true },
        });

        io.emit("tableUpdated", {
          sessionId,
          status: updatedSession.status,
          total: updatedSession.total,
        });

        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/upsert-order-items:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 11) POST /api/close-table
    //--------------------------------------------------
    expressServer.post("/api/close-table", async (req, res) => {
      try {
        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId required" });
        }
        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { status: "closed", closedAt: new Date() },
        });

        io.emit("tableUpdated", {
          sessionId,
          status: "closed",
          total: updatedSession.total,
        });
        return res.status(200).json({ success: true, session: updatedSession });
      } catch (error) {
        console.error("Error in /api/close-table:", error);
        return res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 12) GET /api/session-items
    //--------------------------------------------------
    expressServer.get("/api/session-items", async (req, res) => {
      try {
        const { sessionId } = req.query;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId is required" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { items: true },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const items = session.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          price: it.price,
        }));

        res.json(items);
      } catch (error) {
        console.error("Error in /api/session-items:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 13) GET /api/categories  (ÜRÜN KATEGORİLERİ)
    //--------------------------------------------------
    expressServer.get("/api/categories", async (req, res) => {
      try {
        const cats = await prisma.category.findMany({
          orderBy: { name: "asc" },
        });
        res.json(cats);
      } catch (error) {
        console.error("Error in GET /api/categories:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 14) POST /api/categories (ÜRÜN KATEGORİLERİ)
    //--------------------------------------------------
    expressServer.post("/api/categories", async (req, res) => {
      try {
        const { name } = req.body;
        if (!name) {
          return res
            .status(400)
            .json({ error: "Category name is required" });
        }
        const newCat = await prisma.category.create({
          data: { name },
        });
        res.json(newCat);
      } catch (error) {
        console.error("Error in POST /api/categories:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 15) GET /api/payment-stats
    //--------------------------------------------------
    expressServer.get("/api/payment-stats", async (req, res) => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const payments = await prisma.payment.findMany({
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        const todayTotal = payments.reduce((acc, p) => acc + p.amount, 0);

        const methodTotals = {};
        payments.forEach((p) => {
          const m = p.method || "Diğer";
          if (!methodTotals[m]) methodTotals[m] = 0;
          methodTotals[m] += p.amount;
        });

        // Saatlik dağılım
        const hourlyTotals = {};
        for (let i = 0; i < 24; i++) {
          hourlyTotals[i] = 0;
        }
        payments.forEach((p) => {
          const hour = new Date(p.createdAt).getHours();
          hourlyTotals[hour] += p.amount;
        });
        const dailyData = Object.keys(hourlyTotals).map((hour) => ({
          hour: `${hour}:00`,
          amount: hourlyTotals[hour],
        }));

        const openOrdersTotal = 0;
        const guestCount = 0;

        res.json({
          todayTotal,
          openOrdersTotal,
          guestCount,
          methodTotals,
          dailyData,
        });
      } catch (error) {
        console.error("Error in /api/payment-stats:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 16) POST /api/partial-payment
    //--------------------------------------------------
    expressServer.post("/api/partial-payment", async (req, res) => {
      try {
        const { sessionId, method, amount } = req.body;
        if (!sessionId || amount == null) {
          return res
            .status(400)
            .json({ error: "sessionId ve amount zorunlu" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { payments: true },
        });
        if (!session) {
          return res.status(404).json({ error: "Session yok" });
        }

        const payment = await prisma.payment.create({
          data: {
            tableSessionId: sessionId,
            method: method || "Nakit",
            amount: parseFloat(amount),
          },
        });

        const allPayments = [...session.payments, payment];
        const sumPaid = allPayments.reduce((acc, pay) => acc + pay.amount, 0);

        let updatedSession = null;
        if (sumPaid >= session.total) {
          updatedSession = await prisma.tableSession.update({
            where: { id: sessionId },
            data: {
              status: "paid",
              paymentMethod: method || "Nakit",
              closedAt: new Date(),
            },
            include: { items: true },
          });

          io.emit("tableUpdated", {
            sessionId,
            status: "paid",
            total: updatedSession.total,
          });
        }

        return res.json({
          payment,
          session: updatedSession ?? null,
        });
      } catch (error) {
        console.error("Error in /api/partial-payment:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 17) POST /api/partial-payment/bulk
    //--------------------------------------------------
    expressServer.post("/api/partial-payment/bulk", async (req, res) => {
      try {
        const { sessionId, payments } = req.body;
        if (!sessionId || !Array.isArray(payments)) {
          return res
            .status(400)
            .json({ error: "sessionId ve payments[] gerekli" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          return res.status(404).json({ error: "Session yok" });
        }

        await prisma.payment.createMany({
          data: payments.map((p) => ({
            tableSessionId: sessionId,
            method: p.method || "Nakit",
            amount: parseFloat(p.amount),
          })),
        });

        const updatedSession = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { payments: true },
        });

        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/partial-payment/bulk:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 18) GET /api/session-details
    //--------------------------------------------------
    expressServer.get("/api/session-details", async (req, res) => {
      try {
        const { sessionId } = req.query;
        if (!sessionId) {
          return res
            .status(400)
            .json({ error: "sessionId is required" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: {
            items: true,
            payments: true,
          },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        res.json(session);
      } catch (err) {
        console.error("Error in /api/session-details:", err);
        res.status(500).json({ error: err.message });
      }
    });

    //--------------------------------------------------
    // 19) POST /api/transfer-table
    //--------------------------------------------------
    expressServer.post("/api/transfer-table", async (req, res) => {
      try {
        const { sessionId, newTableId } = req.body;
        if (!sessionId || !newTableId) {
          return res
            .status(400)
            .json({ error: "sessionId ve newTableId gerekli" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          return res.status(404).json({ error: "Session yok" });
        }

        const newTable = await prisma.table.findUnique({
          where: { id: newTableId },
        });
        if (!newTable) {
          return res
            .status(404)
            .json({ error: "Yeni masa yok" });
        }

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { tableIds: { set: [newTableId] } },
          include: { items: true, payments: true },
        });

        io.emit("tableUpdated", {
          sessionId: updatedSession.id,
          status: updatedSession.status,
          total: updatedSession.total,
        });

        res.json(updatedSession);
      } catch (err) {
        console.error("Masa transferi hata:", err);
        res.status(500).json({ error: err.message });
      }
    });

    //--------------------------------------------------
    // 20) POST /api/merge-table
    //--------------------------------------------------
    expressServer.post("/api/merge-table", async (req, res) => {
      try {
        const { mainSessionId, mergeSessionId } = req.body;
        if (!mainSessionId || !mergeSessionId) {
          return res.status(400).json({
            error: "mainSessionId ve mergeSessionId gereklidir",
          });
        }

        const mainSession = await prisma.tableSession.findUnique({
          where: { id: mainSessionId },
          include: { items: true },
        });
        if (!mainSession) {
          return res
            .status(404)
            .json({ error: "Ana session bulunamadı" });
        }
        if (mainSession.status !== "open") {
          return res
            .status(400)
            .json({ error: "Ana session açık olmalı" });
        }

        const mergeSession = await prisma.tableSession.findUnique({
          where: { id: mergeSessionId },
          include: { items: true },
        });
        if (!mergeSession) {
          return res
            .status(404)
            .json({ error: "Birleştirilecek session yok" });
        }
        if (mergeSession.status !== "open") {
          return res
            .status(400)
            .json({ error: "Birleştireceğiniz session açık değil" });
        }

        const oldMergeTotal = mergeSession.items.reduce(
          (acc, cur) => acc + cur.price * cur.quantity,
          0
        );

        await prisma.tableSessionItem.updateMany({
          where: { tableSessionId: mergeSession.id },
          data: { tableSessionId: mainSession.id },
        });

        await prisma.tableSession.update({
          where: { id: mergeSession.id },
          data: { status: "merged" },
        });

        const newTableIds = [
          ...new Set([...mainSession.tableIds, ...mergeSession.tableIds]),
        ];

        const allItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: mainSession.id },
        });
        const newTotal = allItems.reduce(
          (acc, it) => acc + it.price * it.quantity,
          0
        );

        const updatedMainSession = await prisma.tableSession.update({
          where: { id: mainSession.id },
          data: {
            tableIds: { set: newTableIds },
            total: newTotal,
          },
          include: { items: true },
        });

        io.emit("tableUpdated", {
          sessionId: updatedMainSession.id,
          status: updatedMainSession.status,
          total: updatedMainSession.total,
        });
        io.emit("tableUpdated", {
          sessionId: mergeSession.id,
          status: "merged",
          total: oldMergeTotal,
        });

        res.json({
          mainSession: updatedMainSession,
          mergedSessionId: mergeSession.id,
          message: "Masalar başarıyla birleştirildi",
        });
      } catch (err) {
        console.error("Error in /api/merge-table:", err);
        res.status(500).json({ error: err.message });
      }
    });

    //--------------------------------------------------
    // 21) POST /api/transfer-adisyon
    //--------------------------------------------------
    expressServer.post("/api/transfer-adisyon", async (req, res) => {
      try {
        const { sourceSessionId, targetSessionId } = req.body;
        if (!sourceSessionId || !targetSessionId) {
          return res.status(400).json({
            error: "sourceSessionId ve targetSessionId gerekli",
          });
        }

        // Kaynak session'ı al (öğeler dahil)
        const sourceSession = await prisma.tableSession.findUnique({
          where: { id: sourceSessionId },
          include: { items: true },
        });
        if (!sourceSession) {
          return res
            .status(404)
            .json({ error: "Kaynak session bulunamadı" });
        }
        if (sourceSession.status !== "open") {
          return res
            .status(400)
            .json({ error: "Kaynak session açık değil" });
        }

        // Hedef session'ı al (öğeler dahil)
        const targetSession = await prisma.tableSession.findUnique({
          where: { id: targetSessionId },
          include: { items: true },
        });
        if (!targetSession) {
          return res
            .status(404)
            .json({ error: "Hedef session bulunamadı" });
        }
        if (targetSession.status !== "open") {
          return res
            .status(400)
            .json({ error: "Hedef session açık değil" });
        }

        // Kaynak session'daki ürünleri item bazında aktar:
        for (const item of sourceSession.items) {
          // Hedef session'da aynı "name" ile bir kayıt var mı?
          const existingItem = await prisma.tableSessionItem.findUnique({
            where: {
              tableSessionId_name: {
                tableSessionId: targetSessionId,
                name: item.name,
              },
            },
          });
          if (existingItem) {
            // Aynı isimde kayıt varsa, miktarı topla
            await prisma.tableSessionItem.update({
              where: { id: existingItem.id },
              data: { quantity: existingItem.quantity + item.quantity },
            });
            // Kaynak session'daki item'ı sil
            await prisma.tableSessionItem.delete({
              where: { id: item.id },
            });
          } else {
            // Aynı kayıt yoksa, sadece tableSessionId'yi güncelle
            await prisma.tableSessionItem.update({
              where: { id: item.id },
              data: { tableSessionId: targetSessionId },
            });
          }
        }

        // Hedef session'ın toplamını yeniden hesapla
        const updatedTargetItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: targetSessionId },
        });
        const newTotal = updatedTargetItems.reduce(
          (acc, it) => acc + it.price * it.quantity,
          0
        );

        // Hedef session'ı güncelle
        const updatedTargetSession = await prisma.tableSession.update({
          where: { id: targetSessionId },
          data: { total: newTotal },
          include: { items: true },
        });

        // Kaynak session'ı kapat (closed olarak işaretle)
        const updatedSourceSession = await prisma.tableSession.update({
          where: { id: sourceSessionId },
          data: { status: "closed", closedAt: new Date() },
          include: { items: true },
        });

        // Socket.IO ile güncelleme yay
        io.emit("tableUpdated", {
          sessionId: targetSessionId,
          status: updatedTargetSession.status,
          total: updatedTargetSession.total,
        });
        io.emit("tableUpdated", {
          sessionId: sourceSessionId,
          status: "closed",
          total: sourceSession.total,
        });

        res.json({
          message: "Adisyon başarıyla aktarıldı",
          targetSession: updatedTargetSession,
          sourceSession: updatedSourceSession,
        });
      } catch (error) {
        console.error("Error in /api/transfer-adisyon:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 22) GET /api/payment-stats-range  <-- YENİ ENDPOINT (Türkiye saatine göre)
    //--------------------------------------------------
    expressServer.get("/api/payment-stats-range", async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
          return res
            .status(400)
            .json({ error: "startDate ve endDate gerekli" });
        }

        // Kullanıcının gönderdiği tarihleri (YYYY-MM-DD) Türkiye saatine göre yorumla
        // Sonra UTC'ye çevirerek sorguluyoruz
        const start = dayjs
          .tz(startDate, "Europe/Istanbul")
          .startOf("day")
          .utc()
          .toDate();
        const end = dayjs
          .tz(endDate, "Europe/Istanbul")
          .endOf("day")
          .utc()
          .toDate();

        // Belirtilen aralıktaki ödemeleri al (UTC sınırlarına göre)
        const payments = await prisma.payment.findMany({
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });

        // Toplam tutar hesapla
        const todayTotal = payments.reduce((acc, p) => acc + p.amount, 0);

        // Ödeme yöntemlerine göre toplamları hesapla
        const methodTotals = {};
        payments.forEach((p) => {
          const method = p.method || "Diğer";
          if (!methodTotals[method]) methodTotals[method] = 0;
          methodTotals[method] += p.amount;
        });

        res.json({
          todayTotal,
          methodTotals,
        });
      } catch (error) {
        console.error("Error in /api/payment-stats-range:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //
    // ---------------------------------------------------------------------
    // B. Gider Yönetimi (Expense) ile İlgili Kısım
    // ---------------------------------------------------------------------
    //

    //--------------------------------------------------
    // X) (İsteğe Bağlı) GET /api/expense-categories
    //--------------------------------------------------
    // Eğer gider kategorisi modeli eklediyseniz, buradan yönetebilirsiniz.
    expressServer.get("/api/expense-categories", async (req, res) => {
      try {
        const cats = await prisma.expenseCategory.findMany({
          orderBy: { name: "asc" },
          include: {
            expenses: true,
          },
        });
        res.json(cats);
      } catch (error) {
        console.error("Error in /api/expense-categories (GET):", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // X) (İsteğe Bağlı) POST /api/expense-categories
    //--------------------------------------------------
    // Yeni gider kategorisi eklemek için
    expressServer.post("/api/expense-categories", async (req, res) => {
      try {
        const { name } = req.body;
        if (!name) {
          return res
            .status(400)
            .json({ error: "Expense Category name is required" });
        }
        const newCat = await prisma.expenseCategory.create({
          data: { name },
        });
        res.json(newCat);
      } catch (error) {
        console.error("Error in /api/expense-categories (POST):", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 23) GET /api/expenses  <-- Gider Kalemlerini Listele
    //--------------------------------------------------
    expressServer.get("/api/expenses", async (req, res) => {
      try {
        const allExpenses = await prisma.expense.findMany({
          orderBy: { createdAt: "desc" },
          // Giderin kategorisini görmek isterseniz:
          include: { expenseCategory: true },
        });
        res.json(allExpenses);
      } catch (error) {
        console.error("Error in GET /api/expenses:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 24) POST /api/expenses  <-- Yeni Gider Kalemi Ekle
    //--------------------------------------------------
    expressServer.post("/api/expenses", async (req, res) => {
      try {
        const { name, amount, expenseCategoryId } = req.body;
        if (!name || amount == null) {
          return res
            .status(400)
            .json({ error: "Gider adı (name) ve tutar (amount) gereklidir" });
        }

        // Opsiyonel: Gider kategorisine bağlamak için
        const dataObj = {
          name,
          amount: parseFloat(amount),
        };
        if (expenseCategoryId) {
          dataObj.expenseCategory = { connect: { id: expenseCategoryId } };
        }

        const newExpense = await prisma.expense.create({ data: dataObj });
        res.json(newExpense);
      } catch (error) {
        console.error("Error in POST /api/expenses:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 25) GET /api/expense-stats-range
    //--------------------------------------------------
    expressServer.get("/api/expense-stats-range", async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
          return res
            .status(400)
            .json({ error: "startDate ve endDate gerekli" });
        }

        // Tarihleri Türkiye saatine göre yorumla
        const start = dayjs
          .tz(startDate, "Europe/Istanbul")
          .startOf("day")
          .utc()
          .toDate();
        const end = dayjs
          .tz(endDate, "Europe/Istanbul")
          .endOf("day")
          .utc()
          .toDate();

        const expenses = await prisma.expense.findMany({
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });
        const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
        res.json({ totalExpense });
      } catch (error) {
        console.error("Error in /api/expense-stats-range:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //
    // ---------------------------------------------------------------------
    // Next.js routing: Tüm isteklere Next.js sayfa yönlendirmesi
    // ---------------------------------------------------------------------
    //
    expressServer.all("*", (req, res) => {
      return handle(req, res);
    });

    //
    // ---------------------------------------------------------------------
    // Socket.IO Sunucu Ayarları
    // ---------------------------------------------------------------------
    //
    const httpServer = http.createServer(expressServer);
    io = new Server(httpServer, { cors: { origin: "*" } });

    io.on("connection", (socket) => {
      console.log("Bir kullanıcı bağlandı:", socket.id);
      socket.on("mesaj", (data) => {
        console.log("Gelen mesaj:", data);
        io.emit("mesaj", data);
      });
      socket.on("disconnect", () => {
        console.log("Bir kullanıcı ayrıldı:", socket.id);
      });
    });

    //
    // ---------------------------------------------------------------------
    // Sunucu Başlatma
    // ---------------------------------------------------------------------
    //
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log("Sunucu " + PORT + " portunda çalışıyor");
    });
  } catch (err) {
    console.error("Sunucu başlatılırken hata oluştu:", err);
  }
}

main();

/**************************************************************************
 * 
 * SON: Tüm Kod Eksiksiz Verildi
 * 
 **************************************************************************/
