import express from 'express';
const router = express.Router();
import passport from '../config/passport.js'
import userController from '../controllers/user/userController.js';
import AuthMiddleware from '../middlewares/auth.js';

router.get('/',userController.loadHomepage);
router.get('/pageNotFound',userController.pageNotFound);
router.get('/signup',AuthMiddleware.isLogin,userController.loadsignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resend_otp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), async (req, res) => {
  try {
    // Successful authentication

    //  store user id in express-session manually
    req.session.user = req.user._id;
    
    res.redirect('/');
  } catch (error) {
    console.log('Google login error:', error);
    res.redirect('/signup');
  }
});

router.get('/login',AuthMiddleware.isLogin,userController.loadLogin);
router.post('/login',userController.loginUser);
router.get('/logout',userController.logout);

export default router;