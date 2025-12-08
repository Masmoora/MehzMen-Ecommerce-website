import express from 'express';
import router from express.Router();
import passport from '../config/passport';
import userController from '../controllers/user/userController.js';
import auth from '../middlewares/auth.js';

router.get('/',auth.checkSession,userController.loadHomepage);
router.get('/pageNotFound',userController.pageNotFound);
router.get('/signup',auth.isLogin,userController.loadsignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resend_otp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), async (req, res) => {
  try {
    req.session.user = req.user._id;
    res.redirect('/');
  } catch (error) {
    console.log('Google login error:', error);
    res.redirect('/signup');
  }
});

router.get('/login',auth.isLogin,userController.loadLogin);
router.post('/login',userController.loginUser);
router.get('/logout',userController.logout);

export default router;