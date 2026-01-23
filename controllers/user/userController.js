import UserService from '../../service/user/userService.js';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import env from 'dotenv';
env.config();
import HTTP_STATUS from '../../constants/httpStatus.js'

class UserController {
    // ---------- PAGE LOAD FUNCTIONS ----------

    pageNotFound = async (req, res) => {
        try {
            res.render('page-404');
        } catch (error) {
            res.redirect('/pageNotFound');
        }
    };

    loadHomepage = async (req, res) => {
        try {
            const [ newArrivals, categories, brands] = await Promise.all([
                UserService.getNewArrivals(),
                UserService.getCategories(),
                UserService.getBrands()
            ]);
            const userId = req.session.user;
            if (userId) {
                const userData = await UserService.getUserById(userId);
                res.render('home', {
                    user: userData,
                    newArrivals,
                    categories,
                    brands
                });
            } else {
                return res.render('home', {
                    user: null,
                    newArrivals,
                    categories,
                    brands
                });
            }
        } catch (error) {
            console.log('Home page not found', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('server error');
        }
    };

    loadsignup = async (req, res) => {
        try {
            res.render('signup', { user: null, message: null });
        } catch (error) {
            console.log('Signup page error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server error');
        }
    };

    loadLogin = async (req, res) => {
        try {
            res.render('login', { message: null });
        } catch (error) {
            console.log('Login page error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server error');
        }
    };

    // ---------- OTP & EMAIL ----------

    generateOtp() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendVarificationMail(email, otp) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                port: 587,
                secure: false,
                requireTLS: true,
                auth: {
                    user: process.env.NODEMAILER_GMAIL,
                    pass: process.env.NODEMAILER_PASSWORD,
                },
                tls: { rejectUnauthorized: false }

            });
            console.log('before sending mail');
            await transporter.sendMail({
                from: process.env.NODEMAILER_GMAIL,
                to: email,
                subject: 'Verify your account',
                text: `your OTP is ${otp}`,
                html: `<b>Your OTP is: ${otp}</b>`,
            });

            return true;

        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }

    // ---------- SIGNUP ----------

    signup = async (req, res) => {
        try {
            let { name, phone, email, password, cpassword } = req.body;
            console.log(req.body);
            email = email.trim().toLowerCase();

            if (password !== cpassword) return res.render('signup', { message: 'Passwords do not match' });

            const existingUser = await UserService.findByEmail(email);
            if (existingUser) return res.render('signup', { message: 'User already exists' });

            const otp = this.generateOtp();
            console.log(otp);
            const emailSent = await this.sendVarificationMail(email, otp);

            if (!emailSent) return res.render('signup', { message: 'Failed to send OTP. Try again.' });

            // Store temporary signup info in session
            req.session.userData = { name, phone, email, password };
            req.session.userotp = otp;
            req.session.otpPurpose = "signup";
            console.log(' session otp sent', req.session.userotp);

            res.render('verify-otp', {
                purpose: "signup"
            });




            console.log('otp sent', otp);

        } catch (error) {
            console.error('Signup error:', error);
            res.redirect('/pageNotFound');
        }
    };

    // ---------- PASSWORD HASHING ----------

    securePassword = async (password) => {
        return await bcrypt.hash(password, 10);
    };

    // ---------- VERIFY OTP ----------

    verifyOtp = async (req, res) => {
        try {
            const { otp } = req.body;

            if (!otp || otp !== req.session.userotp) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            }

            // 🔥 CHECK PURPOSE
            if (req.session.otpPurpose === "signup") {

                const newUser = req.session.userData;
                const hashedPassword = await this.securePassword(newUser.password);

                const saveUser = await UserService.createUser({
                    name: newUser.name,
                    email: newUser.email,
                    phone: newUser.phone,
                    password: hashedPassword
                });

                req.session.user = saveUser._id;

                // cleanup
                req.session.userData = null;
                req.session.userotp = null;
                req.session.otpPurpose = null;

                return res.json({
                    success: true,
                    redirectUrl: "/login"
                });
            }

            // 🔥 FORGOT PASSWORD FLOW
            if (req.session.otpPurpose === "forgot") {

                req.session.isForgotOtpVerified = true;

                req.session.userotp = null;
                req.session.otpPurpose = null;

                return res.json({
                    success: true,
                    redirectUrl: "/reset-password"
                });
            }

        } catch (error) {
            console.error("OTP verify error:", error);
            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    };

    // ---------- RESEND OTP ----------

    resend_otp = async (req, res) => {
        try {
            let email;

            if (req.session.otpPurpose === "signup") {
                email = req.session.userData?.email;
            }

            if (req.session.otpPurpose === "forgot") {
                email = req.session.forgotEmail;
            }

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: "Email not found"
                });
            }

            const otp = this.generateOtp();
            req.session.userotp = otp;

            const emailSent = await this.sendVarificationMail(email, otp);

            if (emailSent) {
                return res.json({
                    success: true,
                    message: "OTP resent successfully"
                });
            }

            res.status(500).json({
                success: false,
                message: "Failed to resend OTP"
            });

        } catch (error) {
            console.error("Resend OTP error:", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error"
            });
        }
    };


    // ---------- LOGIN ----------

    loginUser = async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email) return res.render('login', { message: 'Email is required' });
            if (!password) return res.render('login', { message: 'Password is required' });
            //fetch user from service
            const existingUser = await UserService.findUserByEmail(email);
            if (!existingUser) return res.render('login', { message: 'Invalid email or password' });
            if (existingUser.isBlocked) return res.render('login', { message: 'User is blocked by admin' });

            const isMatch = await UserService.validatePassword(password, existingUser.password);
            if (!isMatch) return res.render('login', { message: 'Invalid password' });

            // Set session after successful login
            req.session.user = existingUser._id;

            res.redirect('/');

        } catch (error) {
            console.log('Login error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('login', { message: 'Login failed, try again' });
        }
    };

    // ---------- LOGOUT ----------

    logout = async (req, res) => {
        try {
            req.session.destroy(err => {
                if (err) {
                    console.log('Error destroying session:', err);
                    return res.redirect('/pageNotFound');
                }
                res.redirect('/login');
            });
        } catch (error) {
            console.log('Logout error:', error);
            res.redirect('/pageNotFound');
        }
    };
    //show forgot password
    getForgotPasswordPage = (req, res) => {
        res.render("forgotPassword", { message: null });
    };

    forgotPassword = async (req, res) => {
        try {
            const { email } = req.body;

            const user = await UserService.findUserByEmail(email);
            if (!user) {
                return res.render("forgotPassword", {
                    message: "Email not registered"
                });
            }

            const otp = this.generateOtp();
            req.session.userotp = otp;
            req.session.forgotEmail = email;
            req.session.otpPurpose = "forgot";


            const emailSent = await this.sendVarificationMail(email, otp);
            if (!emailSent) {
                return res.render("forgotPassword", {
                    message: "Failed to send OTP"
                });
            }

            res.redirect("/forgot-password/verify-otp");

        } catch (error) {
            console.log("Forgot password error:", error);
            res.render("forgotPassword", {
                message: "Something went wrong"
            });
        }
    };

    loadForgotOtpPage = async (req, res) => {
        res.render("verify-otp", { purpose: "forgot", message: null },);
    };

    loadResetPasswordPage = async (req, res) => {
        if (!req.session.isForgotOtpVerified) {
            return res.redirect("/login");
        }
        res.render("resetPassword", { message: null });
    };

    resetPassword = async (req, res) => {
        try {
            const { password, confirmPassword } = req.body;

            if (password !== confirmPassword) {
                return res.render("resetPassword", {
                    message: "Passwords do not match"
                });
            }

            const hashedPassword = await this.securePassword(password);

            await UserService.updatePasswordByEmail(
                req.session.forgotEmail,
                hashedPassword
            );

            // clear session
            req.session.userotp = null;
            req.session.forgotEmail = null;
            req.session.isOtpVerified = null;

            res.redirect("/login");

        } catch (error) {
            console.log("Reset password error:", error);
            res.render("resetPassword", {
                message: "Password reset failed"
            });
        }
    };

    /*verifyForgotOtp = async (req, res) => {
        try {
            console.log(otp)
            console.log(otpPurpose)
            const { otp } = req.body;
    
            if (!otp || otp !== req.session.userotp) {
                return res.render("forgotOtp", {
                    message: "Invalid OTP"
                });
            }
    
            req.session.isOtpVerified = true;
            res.redirect("/reset-password");
    
        } catch (error) {
            console.log("Verify forgot OTP error:", error);
            res.render("forgotOtp", {
                message: "OTP verification failed"
            });
        }
    };*/



}


export default new UserController();