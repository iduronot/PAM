function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Silakan login terlebih dahulu');
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        user: req.session.user,
        message: 'Anda tidak memiliki akses ke halaman ini',
        currentPage: '',
      });
    }
    next();
  };
}

function requireNotPelanggan(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role === 'pelanggan') {
    return res.redirect('/pelanggan-portal');
  }
  next();
}

module.exports = { requireLogin, requireRole, requireNotPelanggan };
