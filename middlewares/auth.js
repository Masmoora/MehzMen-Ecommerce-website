const User = require('../models/userSchema');
const checkSession = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const userData = await User.findById(req.session.user);
    if (!userData) {
      // Remove only user session
      delete req.session.user;
      return res.redirect('/signup');
    }

    if (userData.isBlocked) {
      delete req.session.user;
      return res.render('login', { message: 'Your account has been blocked by admin.' });
    }

    next();
  } catch (error) {
    console.log('Error in checkSession middleware:', error);
    res.status(500).send('Server error');
  }
};

const isLogin = async (req, res, next) => {
  try {
    if (req.session.user) {
      const userData = await User.findById(req.session.user);

      if (userData && userData.isBlocked) {
        delete req.session.user;
        return res.render('login', { message: 'Your account has been blocked by admin.' });
      }

      return res.redirect('/home');
    }

    next();
  } catch (error) {
    console.log('Error in isLogin middleware:', error);
    res.status(500).send('Server error');
  }
};

// Admin middlewares remain the same
const adminAuth = async (req, res, next) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    const adminId = req.session.admin;
    const admin = await User.findById(adminId);
    if (admin && admin.isAdmin) {
      next();
    } else {
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.log('Access denied: not admin');
    res.status(500).send('Server Error');
  }
};

const isAdminLogin = async (req, res, next) => {
  try {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    next();
  } catch (error) {
    console.log('Error in isAdminLogin middleware:', error);
    res.status(500).send('Server error');
  }
};

module.exports = {
  adminAuth,
  checkSession,
  isLogin,
  isAdminLogin
};