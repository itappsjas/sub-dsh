const express = require("express");
const axios = require("axios");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3101;

// Konfigurasi database
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "hubnet",
  password: process.env.DB_PASS || "JasHubnet2025!",
  database: process.env.DB_NAME || "hubnet",
};

console.log("🛠 Database Configuration:", {
  host: DB_CONFIG.host,
  user: DB_CONFIG.user,
  database: DB_CONFIG.database,
});

(async () => {
  let db;
  try {
    db = await mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
    });
    console.log("✅ Connected to MySQL database.");
  } catch (err) {
    console.error("❌ Failed to connect to MySQL:", err.message);
    process.exit(1);
  }

  const syncHubnet = async () => {
    try {
      console.log("🔄 Fetching data from external API...");
      const response = await axios.get("http://139.5.150.205:3002/api/hubnet");

      // Pastikan rows adalah array yang benar
      const rows = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data.data)
        ? response.data.data
        : [response.data];

      console.log(`🔍 Total records fetched: ${rows.length}`);
      let inserted = 0;
      let skipped = 0;
      let nullAwb = 0;

      for (const item of rows) {
        try {
          if (!item.AWB_NO) {
            nullAwb++;
            console.warn("⚠️ Skipped: missing AWB_NO", item);
            continue;
          }

          // Cek duplikat berdasarkan AWB_NO
          const [exists] = await db.query(
            "SELECT 1 FROM epost_dt_hubnet_dsh WHERE AWB_NO = ? LIMIT 1",
            [item.AWB_NO]
          );

          if (exists.length > 0) {
            skipped++;
            continue;
          }

          // Insert record
          const sql = `
            INSERT INTO epost_dt_hubnet_dsh (
              AWB_NO, COD_FLT_CAR, COD_FLT_NUM, FLT_NUMBER, DAT_FLT_ORI,
              PORT_ORI, PORT_DIS, SHIPMENT_ORI, SHIPMENT_DIS,
              QTY_SHP_PCS, QTY_SHP_WGT, QTY_SHP_VOL, CHG_WGT,
              DES_NOG, COD_COM, COD_SUB_COM, DES_BC11_EXP, DAT_BC11_EXP,
              FLG_IMP_EXP, FLG_DOM_ITL, SENT_STATUS, RF_ID, DAT_RFID
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            Number(item.QTY_SHP_PCS) || 0,
            Number(item.QTY_SHP_WGT) || 0,
            Number(item.QTY_SHP_VOL) || 0,
            Number(item.CHG_WGT) || 0,
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
          ];

          await db.query(sql, values);
          inserted++;
          console.log("✅ Inserted:", item.AWB_NO);
        } catch (err) {
          console.error("❌ Failed insert AWB_NO:", item.AWB_NO || "(no AWB_NO)", err.message);
        }
      }

      console.log(
        `✅ Sync completed — Inserted: ${inserted}, Skipped (existing): ${skipped}, Skipped (null AWB): ${nullAwb}, Total fetched: ${rows.length}`
      );
    } catch (err) {
      console.error("❌ Error during sync:", err.message);
    }
  };

  // Jalankan pertama kali
  await syncHubnet();

  // Jalankan server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  // Auto sync tiap 1 jam
  setInterval(syncHubnet, 1 * 60 * 1000);
})();
