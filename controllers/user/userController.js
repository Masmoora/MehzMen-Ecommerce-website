const User = require("../../models/userSchema");
const bcrypt = require('bcrypt');
const nodemailer = require("nodemailer");
const env = require("dotenv").config()

const pageNotFound = async (req, res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
};

const loadHomepage = async (req, res) => {
    try {
        return res.render("Home")
    } catch (error) {
        console.log("Home page not found")
    }
};

const loadsignup = async (req, res) => {
    try {
        res.render('signup', { user: null, message: null });
    } catch (error) {
        console.log("Signup page error:", error);
        res.status(500).send('Server error');
    }
};

// ---------- OTP & EMAIL ----------

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVarificationMail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_GMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },

        });
        console.log("before sending mail")
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_GMAIL,
            to: email,
            subject: "Verify your account",
            text: `your OTP is ${otp}`,
            html: `<b>Your OTP is: ${otp}</b>`,
        });

        return info.accepted.length > 0;

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}


// ---------- SIGNUP ----------

const signup = async (req, res) => {
    try {
        let {name,phone, email, password, cpassword } = req.body;
        console.log(req.body)


        if (password !== cpassword) return res.render('signup', { message: "Passwords do not match" });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.render('signup', { message: "User already exists" });

        const otp = generateOtp();
        console.log(otp)
        const emailSent = await sendVarificationMail(email, otp);

        if (!emailSent) return res.render('signup', { message: "Failed to send OTP. Try again." });

        // Store temporary signup info in session
        req.session.userData = { name,phone,email, password };
        req.session.userotp = otp;

        res.render('verify-otp');
        console.log("otp sent", otp)
        

    } catch (error) {
        console.error('Signup error:', error);
        res.redirect('/pageNotFound');
    }
};

// ---------- PASSWORD HASHING ----------

const securePassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

// ---------- VERIFY OTP ----------

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp || otp !== req.session.userotp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP, please enter again' });
    }

    const newUser = req.session.userData;
    const hashedPassword = await securePassword(newUser.password);

    const saveUser = new User({
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      password: hashedPassword
    });

    await saveUser.save();

    // Clear temporary session data
    req.session.userData = null;
    req.session.userotp = null;
    //req.session.user = saveUser._id
    // Do NOT log in automatically, redirect to login page
    res.json({ success: true, redirectUrl:"/"});

  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};
// ---------- RESEND OTP ----------

const resend_otp = async (req, res) => {
  try {
    const email = req.session.userData?.email;
    if (!email) return res.status(400).json({ success: false, message: 'Email not found in session' });

    const otp = generateOtp();
    req.session.userotp = otp;
    console.log(otp)

    const emailSent = await sendVarificationMail(email, otp);

    if (emailSent) return res.status(200).json({ success: true, message: 'OTP resent successfully' });
    return res.status(500).json({ success: false, message: 'Failed to resend OTP' });

  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};



module.exports = {
    loadHomepage,
    pageNotFound,
    loadsignup,
    signup,
    verifyOtp 
}