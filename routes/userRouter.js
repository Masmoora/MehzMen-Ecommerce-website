import express from 'express';
const router = express.Router();
import passport from '../config/passport.js';
import userController from '../controllers/user/userController.js';
import AuthMiddleware from '../middlewares/auth.js';
import AllProductsController from '../controllers/user/allProductsController.js';
import ProfileController from '../controllers/user/profileController.js';
import s3Upload from '../middlewares/multer.js';

router.get('/',userController.loadHomepage);
router.get('/pageNotFound',userController.pageNotFound);
router.get('/signup',AuthMiddleware.isLogin,userController.loadsignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resend_otp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup?error=blocked' }), async (req, res) => {
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

router.get('/forgot-password', userController.getForgotPasswordPage);
router.post('/forgot-password', userController.forgotPassword);

// verify otp (forgot password)
router.get('/forgot-password/verify-otp', userController.loadForgotOtpPage);
//router.post("/forgot-password/verify-otp", userController.verifyForgotOtp);

// reset password
router.get('/reset-password', userController.loadResetPasswordPage);
router.post('/reset-password', userController.resetPassword);

// User-side product listing
router.get('/allProducts', AllProductsController.loadAllProducts);

// Product details page
router.get('/productDetails/:id', AllProductsController.loadProductDetails);
//profile management
router.get('/userProfile', ProfileController.loadUserProfile)
router.get('/edit-userProfile', ProfileController.loadEditProfile)
router.post('/edit-userProfile',s3Upload('userProfile').single('profileImage'), ProfileController.updateProfile)
router.get('/change-email', ProfileController.getChangeEmail)
router.post('/change-email', ProfileController.changeEmail)
router.get('/verify-email-otp',  ProfileController.getVerifyEmailOtp)
router.post('/verify-email-otp', ProfileController.verifyEmailOtp)
router.post('/resend-change-Email-otp', (req,res,next)=>{
   console.log("ROUTE HIT");
   next()},ProfileController.resendChangeEmailOtp)
router.post('/change-password', ProfileController.changePassword)
//user address management
router.get('/address',ProfileController.loadAddressPage);
router.post('/add-address', ProfileController.addAddress);
router.post('/edit-address/:id', ProfileController.editAddress);
router.post('/delete-address/:id', ProfileController.deleteAddress);

export default router;