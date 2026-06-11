const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireLogin } = require('../middleware/auth');
const { User } = require('../models');
const { log } = require('../helpers/audit');

router.get('/ganti-password', requireLogin, (req, res) => {
  res.render('akun/ganti-password', { currentPage: '' });
});

router.post('/ganti-password', requireLogin, async (req, res) => {
  try {
    const { password_lama, password_baru, password_konfirm } = req.body;
    if (!password_lama || !password_baru) {
      req.flash('error', 'Semua field wajib diisi');
      return res.redirect('/akun/ganti-password');
    }
    if (password_baru !== password_konfirm) {
      req.flash('error', 'Konfirmasi password tidak cocok');
      return res.redirect('/akun/ganti-password');
    }
    const user = await User.findByPk(req.session.user.id);
    const valid = await bcrypt.compare(password_lama, user.password);
    if (!valid) {
      req.flash('error', 'Password lama tidak sesuai');
      return res.redirect('/akun/ganti-password');
    }
    const hash = await bcrypt.hash(password_baru, 10);
    await user.update({ password: hash });
    await log(user.id, 'CHANGE_PASSWORD', 'users', user.id, null, null, req.ip);
    req.flash('success', 'Password berhasil diubah');
    res.redirect('/akun/ganti-password');
  } catch (e) {
    console.error('[POST /akun/ganti-password]', e.message);
    req.flash('error', 'Gagal mengubah password');
    res.redirect('/akun/ganti-password');
  }
});

module.exports = router;
