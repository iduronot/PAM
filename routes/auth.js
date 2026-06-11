const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, Pelanggan } = require('../models');
const { log } = require('../helpers/audit');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { currentPage: 'login' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user || !user.is_active) {
      req.flash('error', 'Username atau password salah');
      return res.redirect('/login');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      req.flash('error', 'Username atau password salah');
      return res.redirect('/login');
    }
    req.session.user = {
      id: user.id, nama: user.nama, username: user.username,
      email: user.email, role: user.role, pelanggan_id: user.pelanggan_id,
    };
    await log(user.id, 'LOGIN', 'users', user.id, null, null, req.ip, `Login berhasil`);
    if (user.role === 'pelanggan') return res.redirect('/pelanggan-portal');
    res.redirect('/dashboard');
  } catch (e) {
    req.flash('error', 'Terjadi kesalahan sistem');
    res.redirect('/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
