const { AuditLog } = require('../models');

async function log(userId, aksi, tabelNama, recordId, dataLama, dataBaru, ipAddress, keterangan) {
  try {
    await AuditLog.create({
      user_id: userId,
      aksi,
      tabel_nama: tabelNama,
      record_id: recordId,
      data_lama: dataLama ? JSON.stringify(dataLama) : null,
      data_baru: dataBaru ? JSON.stringify(dataBaru) : null,
      ip_address: ipAddress,
      keterangan,
    });
  } catch (e) {
    // audit log tidak boleh gagalkan request utama
  }
}

module.exports = { log };
