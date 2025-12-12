import UserService from '../../service/userService.js';
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
            const userId = req.session.user;
            if (userId) {
                const userData = await UserService.getUserById(userId);
                res.render('home', { user: userData });
            } else {
                return res.render('home',{user:null});
            }
        } catch (error) {
            console.log('Home page not found', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('server error');
        }
    };

    loadsignup = async (req, res) => {
        try {
            res.render('signup', {user:null, message: null });
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
                tls:{rejectUnauthorized:false}

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
            //email = email.trim().toLowerCase();

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
            console.log(' session otp sent', req.session.userotp);
            
            res.render('verify-otp');

            

            
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
            console.log("received otp",otp)
            console.log("session otp",req.session.userotp)

            if (!otp || otp !== req.session.userotp) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid OTP, please enter again' });
            }

            const newUser = req.session.userData;
            const hashedPassword = await this.securePassword(newUser.password);

            const saveUser = await UserService.createUser({  //or new User().save()
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                password: hashedPassword
            })

            // Clear temporary session data
           // req.session.userData = null;
           // req.session.userotp = null;
            req.session.user = saveUser._id;
            req.session.userData = null;
            req.session.userotp = null
            // Do NOT log in automatically, redirect to login page
            return res.redirect('/login')

        } catch (error) {
            console.error('Error verifying OTP:', error);
            res.redirect('/pageNotFound')
        }
    };
    // ---------- RESEND OTP ----------

    resend_otp = async (req, res) => {
        try {
            const email = req.session.userData?.email;
            if (!email) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Email not found in session' });

            const otp = this.generateOtp();
            req.session.userotp = otp;
            console.log(otp);

            const emailSent = await this.sendVarificationMail(email, otp);

            if (emailSent) return res.status(HTTP_STATUS.OK).json({ success: true, message: 'OTP resent successfully' });
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to resend OTP' });

        } catch (error) {
            console.error('Error resending OTP:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal Server Error' });
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
}

export default new UserController();