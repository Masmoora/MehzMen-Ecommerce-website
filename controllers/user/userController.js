const User = require("../../models/userSchema")

const pageNotFound=async (req,res)=>{
    try{
        res.render("page-404")
    }catch(error){
        res.redirect("/pageNotFound")
    }
};

const loadHomepage=async (req,res)=>{
    try{
        return res.render("Home")
    }catch(error){
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

const signup = async (req,res) => {
    const {name,email,phone,password,cpassword} = req.body;
    try{
        const newUser = new User({name,email,phone,password,cpassword});
        console.log(newUser);
        await newUser.save();
        return res.redirect("/signup");
    }catch(error){
        console.error("error for saving user",error);
        res.status(500).send("Internal server error")
    }
}

module.exports={
    loadHomepage,
    pageNotFound,
    loadsignup,
    signup
}