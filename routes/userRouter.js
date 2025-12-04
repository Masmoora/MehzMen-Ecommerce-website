const express=require("express");
const router=express.Router();
const passport = require('../config/passport');
const userController=require("../controllers/user/userController");

router.get("/",userController.loadHomepage);
router.get("/pageNotFound",userController.pageNotFound);
router.get('/signup',userController.loadsignup)
router.post('/signup',userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resend_otp)

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), async (req, res) => {
  try {
    req.session.user = req.user._id;
    res.redirect('/');
  } catch (error) {
    console.log("Google login error:", error);
    res.redirect('/signup');
  }
});

router.get('/login',userController.loadLogin)
router.post('/login',userController.loginUser)

module.exports=router;