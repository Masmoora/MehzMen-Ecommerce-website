import express from 'express';
const router = express.Router();
import passport from '../config/passport.js';
import userController from '../controllers/user/userController.js';
import AuthMiddleware from '../middlewares/auth.js';
import AllProductsController from '../controllers/user/allProductsController.js';
import ProfileController from '../controllers/user/profileController.js';
import WishlistController from '../controllers/user/wishlistController.js';
import s3Upload from '../middlewares/multer.js';
import CartController from '../controllers/user/cartController.js';
import CheckoutController from '../controllers/user/checkoutController.js';
import OrderController from '../controllers/user/orderController.js';
import WalletController from '../controllers/user/walletController.js';

router.get('/',userController.loadHomepage);
router.get('/pageNotFound',userController.pageNotFound);
router.get('/signup',AuthMiddleware.isLogin,userController.loadsignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resend_otp);

router.get('/auth/google',AuthMiddleware.isLogin, passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', AuthMiddleware.isLogin,passport.authenticate('google', { failureRedirect: '/signup?error=blocked' }), async (req, res) => {
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
router.post('/login',AuthMiddleware.isLogin,userController.loginUser);
router.get('/logout',AuthMiddleware.checkSession,userController.logout);

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
router.get('/userProfile',AuthMiddleware.checkSession, ProfileController.loadUserProfile)
router.get('/edit-userProfile',AuthMiddleware.checkSession, ProfileController.loadEditProfile)
router.post('/edit-userProfile',AuthMiddleware.checkSession,s3Upload('userProfile').single('profileImage'), ProfileController.updateProfile)
router.get('/change-email',AuthMiddleware.checkSession, ProfileController.getChangeEmail)
router.post('/change-email',AuthMiddleware.checkSession, ProfileController.changeEmail)
router.get('/verify-email-otp', AuthMiddleware.checkSession, ProfileController.getVerifyEmailOtp)
router.post('/verify-email-otp', AuthMiddleware.checkSession,ProfileController.verifyEmailOtp)
router.post('/resend-change-Email-otp',AuthMiddleware.checkSession, (req,res,next)=>{
   console.log("ROUTE HIT");
   next()},ProfileController.resendChangeEmailOtp)
router.post('/change-password',AuthMiddleware.checkSession, ProfileController.changePassword)
//user address management
router.get('/address',AuthMiddleware.checkSession,ProfileController.loadAddressPage);
router.post('/add-address',AuthMiddleware.checkSession, ProfileController.addAddress);
router.post('/edit-address/:id',AuthMiddleware.checkSession, ProfileController.editAddress);
router.post('/delete-address/:id', AuthMiddleware.checkSession,ProfileController.deleteAddress);
router.get('/profile/coupons', ProfileController.loadCouponsPage)
//user wishlist management
router.get('/wishlist',AuthMiddleware.checkSession,  WishlistController.loadWishlist);
router.post('/wishlist/add', AuthMiddleware.checkSession,WishlistController.addToWishlist);
router.delete('/wishlist/remove/:productId',AuthMiddleware.checkSession,  WishlistController.removeFromWishlist);

// Used by wishlist modal to fetch active variants
router.get('/wishlist/variants/:productId', AuthMiddleware.checkSession,WishlistController.getVariantsForModal);

// Cart
router.get('/cart', AuthMiddleware.checkSession, CartController.loadCart)
router.post('/cart/add', AuthMiddleware.checkSession,CartController.addToCart)
router.patch('/cart/update-quantity',AuthMiddleware.checkSession,  CartController.updateQuantity);
//router.patch('/cart/item/:itemId/decrease',  CartController.decreaseQuantity)
//router.delete('/cart/item/:itemId',  CartController.removeItem)
router.delete('/cart/remove/:itemId',AuthMiddleware.checkSession, CartController.removeItem);

//checkout management
router.get('/checkout',AuthMiddleware.checkSession,  CheckoutController.loadCheckout);
router.delete('/checkout/item/:itemId', AuthMiddleware.checkSession, CheckoutController.removeCheckoutItem);
router.post('/checkout/address', AuthMiddleware.checkSession, CheckoutController.addAddress);
router.patch('/checkout/address/:addressId',  AuthMiddleware.checkSession,CheckoutController.updateAddress);
router.delete('/checkout/address/:addressId',AuthMiddleware.checkSession,CheckoutController.deleteAddress);
router.post('/checkout/apply-coupon', CheckoutController.applyCoupon);
router.post('/checkout/remove-coupon', CheckoutController.removeCoupon);
router.post('/checkout/place-order', CheckoutController.placeOrder);
router.post('/checkout/create-razorpay-order',  CheckoutController.createRazorpayOrder);
router.post('/checkout/verify-payment',  CheckoutController.verifyPayment);

//order management

router.get('/orders', AuthMiddleware.checkSession, OrderController.loadOrders);
router.get('/orders/success', OrderController.loadOrderSuccess);
router.get('/orders/failure', OrderController.loadOrderFailure);
router.get('/orders/:orderId',AuthMiddleware.checkSession,  OrderController.loadOrderDetails);
router.patch('/orders/:orderId/items/:itemId/cancel',AuthMiddleware.checkSession,  OrderController.cancelSingleItem);
router.patch('/orders/:orderId/cancel', AuthMiddleware.checkSession, OrderController.cancelEntireOrder);
router.patch('/orders/:orderId/return', AuthMiddleware.checkSession, OrderController.requestReturnOrder);
//router.patch('/orders/:orderId/items/:itemId/return-request',AuthMiddleware.checkSession, OrderController.requestItemReturn)
// SINGLE ITEM RETURN
router.patch(
  '/orders/:orderId/items/:itemId/return-request',
  AuthMiddleware.checkSession,
  OrderController.requestItemReturn
);

// CANCEL SINGLE ITEM RETURN
router.patch(
  '/orders/:orderId/items/:itemId/cancel-return-request',
  AuthMiddleware.checkSession,
  OrderController.cancelItemReturnRequest
);

// CANCEL ENTIRE RETURN REQUEST
router.patch(
  '/orders/:orderId/cancel-return',
  AuthMiddleware.checkSession,
  OrderController.cancelEntireReturnRequest
);
router.get('/orders/:orderId/invoice', AuthMiddleware.checkSession,OrderController.downloadInvoice);



//wallet management
//router.get('/wallet',WalletController.loadWalletPage)
router.get('/wallet',  WalletController.loadWalletPage);
router.post('/wallet/add-money',  WalletController.addMoney);
router.post('/wallet/verify-payment',  WalletController.verifyPayment);

export default router;