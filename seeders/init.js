require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, KategoriPelanggan, Rute } = require('../models');

async function seed() {
  try {
    await sequelize.sync({ force: false });

    // Buat Super Admin jika belum ada
    const existing = await User.findOne({ where: { username: 'admin' } });
    if (!existing) {
      const hash = await bcrypt.hash('admin123', 10);
      await User.create({
        nama: 'Super Admin',
        username: 'admin',
        email: 'admin@pamsimas.local',
        password: hash,
        role: 'super_admin',
        is_active: true,
      });
      console.log('✓ Super Admin dibuat: admin / admin123');
    }

    // Kategori Pelanggan default
    const kategoriData = [
      { nama: 'Rumah Tangga', deskripsi: 'Pelanggan rumah tangga biasa' },
      { nama: 'Niaga Kecil', deskripsi: 'Usaha kecil dan warung' },
      { nama: 'Niaga Besar', deskripsi: 'Usaha besar dan industri' },
      { nama: 'Sosial', deskripsi: 'Masjid, sekolah, panti' },
      { nama: 'Instansi Pemerintah', deskripsi: 'Kantor desa, kelurahan' },
    ];
    for (const k of kategoriData) {
      await KategoriPelanggan.findOrCreate({ where: { nama: k.nama }, defaults: k });
    }
    console.log('✓ Kategori pelanggan default dibuat');

    // Rute default
    const ruteData = [
      { nama_rute: 'Rute A', deskripsi: 'Wilayah Timur', urutan: 1 },
      { nama_rute: 'Rute B', deskripsi: 'Wilayah Barat', urutan: 2 },
      { nama_rute: 'Rute C', deskripsi: 'Wilayah Utara', urutan: 3 },
      { nama_rute: 'Rute D', deskripsi: 'Wilayah Selatan', urutan: 4 },
    ];
    for (const r of ruteData) {
      await Rute.findOrCreate({ where: { nama_rute: r.nama_rute }, defaults: r });
    }
    console.log('✓ Rute default dibuat');

    console.log('\n🎉 Seeder selesai!');
    console.log('   Login: admin / admin123');
    console.log('   URL: http://localhost:3001');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seeder gagal:', e.message);
    process.exit(1);
  }
}

seed();
