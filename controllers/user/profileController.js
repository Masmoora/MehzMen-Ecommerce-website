import UserService from '../../service/user/userService.js';
import ProfileService from '../../service/user/profileService.js';
import logger from '../../logger.js';
import UserController from '../../controllers/user/userController.js'
import userController from '../../controllers/user/userController.js';

class ProfileController {
  //user profile page
  loadUserProfile = async (req, res) => {
    try {
      const userId = req.session.user;

      if (!userId) return res.redirect('/login');

      const userData = await UserService.getUserById(userId);

      if (!userData) return res.redirect('/pageNotFound');

      res.render('userProfile', { user: userData, success: req.query?.success || '' });
    } catch (error) {
      console.error('Error loading profile:', error);
      res.redirect('/pageNotFound');
    }
  }
  loadEditProfile = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const userData = await UserService.getUserById(userId);
      if (!userData) return res.redirect('/pageNotFound');

      res.render('editUserProfile', {
        user: userData, success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (error) {
      logger.error('Error loading edit profile page:', error);
      res.status(500).render('page-404');
    }
  };
  updateProfile = async (req, res) => {
    try {
      console.log('SESSION USER:', req.session.user);
      console.log('FORM DATA:', req.body);
      console.log('FILE:', req.file);

      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const updateData = {
        name: req.body.name?.trim(),
        phone: req.body.phone?.trim(),
        updatedAt: new Date(),
      };

      // If image uploaded → S3 URL
      if (req.file && req.file.location) {
        updateData.profileImage = req.file.location;
      }

      await ProfileService.updateUserProfileById(userId, updateData);

      res.redirect('/userProfile?success=profile-updated');
    } catch (error) {
      console.error('Update profile error:', error);
      res.redirect('/edit-profile?error=update-failed');
    }


  };
  getChangeEmail = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const userData = await UserService.getUserById(userId);
      if (!userData) return res.redirect('/pageNotFound');

      res.render('change-Email', {
        user: userData,
        alert: req.query?.alert || '',
        formData: {}
      });
    } catch (error) {
      logger.error('Error loading change email page:', error);
      res.status(500).render('page-404');
    }
  };
  changeEmail = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const { newEmail, password } = req.body || {};
      const emailValue = (newEmail || '').trim().toLowerCase();
      const passwordValue = (password || '').trim();

      if (!emailValue || !passwordValue) {
        return res.redirect('/change-email?alert=required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        return res.redirect('/change-email?alert=invalid-email');
      }

      const userData = await UserService.getUserById(userId);
      if (!userData) return res.redirect('/pageNotFound');

      if (emailValue === (userData.email || '').toLowerCase()) {
        return res.redirect('/change-email?alert=same-email');
      }

      const emailTaken = await ProfileService.isEmailTaken(emailValue, userId);
      if (emailTaken) {
        return res.redirect('/change-email?alert=email-exists');
      }

      const passwordOk = await ProfileService.verifyPassword(passwordValue, userData.password);
      if (!passwordOk) {
        return res.redirect('/change-email?alert=invalid-password');
      }

      const otp = UserController.generateOtp();
      const emailSent = await UserController.sendVarificationMail(emailValue, otp);

      if (!emailSent) {
        return res.redirect('/change-email?alert=send-failed');
      }

      req.session.userotp = otp;
      req.session.otpPurpose = 'change-email';
      req.session.pendingEmail = emailValue;

      console.log('OTP SAVED:', req.session.userotp);
      console.log('EMAIL SAVED:', req.session.pendingEmail);

      res.redirect('/verify-email-otp?alert=otp-sent');
    } catch (error) {
      logger.error('Error sending change email OTP:', error);
      res.redirect('/change-email?alert=server-error');
    }
  };
  getVerifyEmailOtp = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const userData = await UserService.getUserById(userId);
      if (!userData) return res.redirect('/pageNotFound');

      res.render('verifyEmailOtp', {
        user: userData,
        alert: req.query?.alert || '',
        pendingEmail: req.session?.pendingEmail || ''
      });
    } catch (error) {
      logger.error('Error loading verify email OTP page:', error);
      res.status(500).render('page-404');
    }
  };
  verifyEmailOtp = async (req, res) => {
    try {
      const { otp } = req.body;

      console.log('ENTERED OTP:', otp);
      console.log('SESSION OTP:', req.session.userotp);

      if (!req.session.userotp || !req.session.pendingEmail) {
        return res.json({ success: false, message: 'Session expired' });
      }

      if (String(otp) !== String(req.session.userotp)) {
        return res.json({ success: false, message: 'Invalid OTP' });
      }

      await ProfileService.updateEmail(req.session.user, req.session.pendingEmail);

      // clear session
      req.session.userotp = null;
      req.session.pendingEmail = null;

      res.json({ success: true, redirectUrl: '/userProfile?success=email-updated' });
    } catch (error) {
      console.error(error);
      res.json({ success: false, message: 'Server error' });
    }
  };


  resendChangeEmailOtp = async (req, res) => {
    try {
      console.log('PENDING EMAIL:', req.session.pendingEmail);

      if (!req.session.pendingEmail) {
        return res.json({ success: false, message: 'Session expired' });
      }

      const otp = UserController.generateOtp();
      await UserController.sendVarificationMail(req.session.pendingEmail, otp);

      req.session.userotp = String(otp);

      console.log('RESEND OTP:', req.session.userotp);

      res.json({ success: true, message: 'OTP resent successfully' });
    } catch (error) {
      console.error('RESEND ERROR:', error);
      res.json({ success: false, message: 'Server error' });
    }
  };

  changePassword = async (req, res) => {

    try {
      const userId = req.session?.user;

      if (!userId) {
        return res.json({ success: false, message: 'Session expired' });
      }
      const { currentPassword, newPassword, confirmPassword } = req.body;

      // -------- validation --------
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.json({ success: false, message: 'All fields required' });
      }

      if (newPassword !== confirmPassword) {
        return res.json({ success: false, message: 'Passwords do not match' });
      }

      // -------- get user --------
      const user = await UserService.getUserById(userId);
      if (!user) {
        return res.json({ success: false, message: 'User not found' });
      }
      // ---------- Verify Current Password ----------
      const isValid = await UserService.validatePassword(
        currentPassword,
        user.password
      );
      if (!isValid) {
        return res.json({
          success: false,
          message: "Current password is incorrect"
        });
      }
      // ---------- Hash New Password ----------
      const hashedPassword = await userController.securePassword(newPassword);
      // ---------- Update Password ----------
      await UserService.updatePasswordByEmail(
        user.email,
        hashedPassword
      );
      return res.json({
        success: true,
        message: "Password changed successfully"
      });

    } catch (error) {

      console.log(error);

      return res.json({
        success: false,
        message: "Internal Server Error"
      });

    }

  };
  /*loadAddressPage = async (req,res)=>{
  
   try{
  
     const userId = req.session.user._id;
  
     const page = parseInt(req.query.page) || 1;
     const limit = 4;
     const skip = (page-1)*limit;
  
     const addressData = await ProfileService.getUserAddresses(userId);
  
     const addresses = addressData?.address || [];
  
     const paginatedAddresses = addresses.slice(skip, skip+limit);
  
     const totalPages = Math.ceil(addresses.length/limit);
  
     res.render('address',{
  
        user:req.session.user,
        addressData,
        addresses: paginatedAddresses,
        totalPages,
        currentPage:page
  
     });
  
   }catch(err){
  
     console.log(err);
     res.redirect('/profile');
  
   }
  
  }*/
  /* loadAddressPage = async (req, res) => {
     try {
       const userId = req.session?.user;
       if (!userId) return res.redirect('/login');
 
       const user = await UserService.getUserById(userId);
       if (!user) return res.redirect('/pageNotFound');
 
       const page = Number(req.query.page) || 1;
       const limit = 2;
       const { addresses, currentPage, totalPages } = await ProfileService.getUserAddresses(userId, page, limit);
 
       return res.render('address', {
         user,
         addresses: addresses || [],
         currentPage,
         totalPages
       });
     } catch (error) {
       logger.error('Error loading address page:', error);
       return res.redirect('/pageNotFound');
     }
   };*/
  loadAddressPage = async (req, res) => {

    try {

      const userId = req.session.user;
      if (!userId) return res.redirect("/login");

      const user = await UserService.getUserById(userId);

      const page = Number(req.query.page) || 1;
      const limit = 2;

      const result = await ProfileService.getUserAddresses(
        userId,
        page,
        limit
      );

      res.render("address", {
        user,
        addresses: result.addresses,
        currentPage: result.currentPage,
        totalPages: result.totalPages
      });

    } catch (error) {

      console.log(error);
      res.redirect("/pageNotFound");

    }
  };
  addAddress = async (req, res) => {

    try {

      const userId = req.session.user;
      const isDefault = req.body.isDefault === "on";

      const {
        fullName,
        mobile,
        houseNo,
        city,
        landmark,
        state,
        pincode,
        country
      } = req.body;
      console.log(req.body);
      // SERVER VALIDATION
      if (!fullName || !mobile || !houseNo || !city || !state || !pincode) {
        return res.json({
          success: false,
          message: "All fields required"
        });
      }

      const addressData = {
        name: fullName,
        phone: mobile,
        houseNo,
        landMark: landmark,
        city,
        state,
        pincode,
        country,
        isDefault
      };

      const result = await ProfileService.addAddress(userId, addressData);

      // Return last inserted address
      const newAddress = result.address[result.address.length - 1];

      res.json({
        success: true,
        address: newAddress
      });

    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false });
    }

  }
  editAddress = async (req, res) => {

    try {

      const userId = req.session.user;
      const addressId = req.params.id;

      const updatedData = {
        name: req.body.fullName,
        houseNo: req.body.houseNo,
        city: req.body.city,
        landMark: req.body.landmark,
        state: req.body.state,
        country: req.body.country,
        pincode: req.body.pincode,
        phone: req.body.mobile,
        isDefault: req.body.isDefault === "on"
      };

      const result = await ProfileService.editAddress(
        userId,
        addressId,
        updatedData
      );

      if (!result) {
        return res.json({
          success: false,
          message: "Address update failed"
        });
      }

      res.json({
        success: true,
        message: "Address updated successfully"
      });

    } catch (error) {

      console.log("Controller edit error:", error);

      res.json({
        success: false,
        message: "Server error"
      });

    }
  }
  deleteAddress = async (req, res) => {

    try {

      const userId = req.session.user;
      const addressId = req.params.id;

      const result = await ProfileService.deleteAddress(
        userId,
        addressId
      );

      if (!result) {
        return res.json({
          success: false,
          message: "Address not found"
        });
      }

      res.json({
        success: true,
        message: "Address deleted successfully"
      });

    } catch (error) {

      console.log("Delete controller error:", error);

      res.json({
        success: false,
        message: "Server error"
      });

    }
  };
  loadCouponsPage = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const { referralCoupons, availableCoupons, allCoupons } = await ProfileService.getCouponsForUserProfile(userId);

      return res.render('coupons', {
        user,
        referralCode: user.referralCode || '',
        referralCoupons,
        availableCoupons,
        coupons: allCoupons,
        activeItem: 'coupons'
      });
    } catch (error) {
      logger.error('Error loading coupons page:', error);
      return res.status(500).render('page-404');
    }
  };


}
export default new ProfileController();