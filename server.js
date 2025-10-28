const express = require("express");
const axios = require("axios");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3101;

// Validasi variabel environment penting
const requiredEnv = ["DB_HOST", "DB_USER", "DB_NAME"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`⚠️  Warning: environment variable ${key} is not set`);
  }
}

// Koneksi ke MySQL
(async () => {
  const db = await mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "hubnet",
    password: process.env.DB_PASS || "JasHubnet2025!",
    database: process.env.DB_NAME || "hubnet",
    waitForConnections: true,
    connectionLimit: 10,
  });

  // Endpoint untuk GET dan insert
  app.get("/api/sync-hubnet", async (req, res) => {
    try {
      // Ambil data dari API eksternal
      const { data } = await axios.get("http://139.5.150.15:3006/api/data");
      const rows = Array.isArray(data) ? data : [data];
      let inserted = 0;
      let skipped = 0;

      for (const item of rows) {
        const [exists] = await db.query(
          "SELECT AWB_NO FROM epost_dt_hubnet_dsh WHERE AWB_NO = ? LIMIT 1",
          [item.AWB_NO]
        );

        if (exists.length > 0) {
          skipped++;
          continue;
        }

        const sql = `
          INSERT INTO epost_dt_hubnet_dsh (
            AWB_NO, COD_FLT_CAR, COD_FLT_NUM, FLT_NUMBER, DAT_FLT_ORI,
            PORT_ORI, PORT_DIS, SHIPMENT_ORI, SHIPMENT_DIS,
            QTY_SHP_PCS, QTY_SHP_WGT, QTY_SHP_VOL, CHG_WGT,
            DES_NOG, COD_COM, COD_SUB_COM, DES_BC11_EXP, DAT_BC11_EXP,
            FLG_IMP_EXP, FLG_DOM_ITL, SENT_STATUS, RF_ID, DAT_RFID, is_uploaded
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          item.AWB_NO,
          item.COD_FLT_CAR,
          item.COD_FLT_NUM,
          item.FLT_NUMBER,
          item.DAT_FLT_ORI ? new Date(item.DAT_FLT_ORI) : null,
          item.PORT_ORI,
          item.PORT_DIS,
          item.SHIPMENT_ORI,
          item.SHIPMENT_DIS,
          item.QTY_SHP_PCS,
          item.QTY_SHP_WGT,
          item.QTY_SHP_VOL,
          item.CHG_WGT,
          item.DES_NOG,
          item.COD_COM,
          item.COD_SUB_COM,
          item.DES_BC11_EXP,
          item.DAT_BC11_EXP ? new Date(item.DAT_BC11_EXP) : null,
          item.FLG_IMP_EXP,
          item.FLG_DOM_ITL,
          item.SENT_STATUS,
          item.RF_ID,
          item.DAT_RFID ? new Date(item.DAT_RFID) : null,
          item.is_uploaded,
        ];

        await db.query(sql, values);
        inserted++;
      }

      res.json({
        message: `✅ Sync completed`,
        inserted,
        skipped,
        totalFetched: rows.length,
      });
    } catch (err) {
      console.error("❌ Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
  );
})();
