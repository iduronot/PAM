function formatRupiah(angka) {
  if (!angka && angka !== 0) return 'Rp 0';
  return 'Rp ' + parseFloat(angka).toLocaleString('id-ID', { minimumFractionDigits: 0 });
}

function formatTanggal(date) {
  if (!date) return '-';
  const d = new Date(date);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTanggalLengkap(date) {
  if (!date) return '-';
  const d = new Date(date);
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function namaBulan(bulan) {
  const b = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return b[bulan] || '-';
}

function generateNomorTagihan(periodeId, pelangganId) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const p = String(pelangganId).padStart(5, '0');
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `TGH${y}${m}${p}${rand}`;
}

function generateNomorPembayaran() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `PAY${y}${m}${d}${rand}`;
}

function generateNomorTiket() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  return `TKT${y}${m}${rand}`;
}

function generateNoPelanggan(lastId) {
  return 'PLG' + String(lastId + 1).padStart(5, '0');
}

module.exports = {
  formatRupiah, formatTanggal, formatTanggalLengkap,
  namaBulan, generateNomorTagihan, generateNomorPembayaran,
  generateNomorTiket, generateNoPelanggan,
};
