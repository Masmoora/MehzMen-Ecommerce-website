const User = require("../../models/userSchema");
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const pageerror = async (req, res) => {
  res.render('pageerror')
}

const loadLogin = async (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard')
    }
    res.render('admin-login', { message: null })
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email) {
            return res.render('admin-login', { message: 'Email is required' })
        }
        if (!password) {
            return res.render('admin-login', { message: 'Enter Password' })
        }
        const admin = await User.findOne({ email: email, isAdmin: true })
        if (!admin) {
            return res.render('admin-login', { message: 'Admin not found' })
        }
        const isMatch = await bcrypt.compare(password, admin.password)
        if (isMatch) {
            req.session.admin = true
            return res.redirect("/admin/dashboard")
        } else {
            return res.redirect("/admin/login")
        }
    } catch (error) {
        console.log("login error", error)
        return res.redirect("/pageerror")

    }
}

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      return res.render('dashboard')
    } catch (error) {
      return res.render('pageerror')
    }
  }
}

const logout = async (req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err)
                return res.redirect("/pageerror")
            }
            res.redirect("/admin/login")
        })
    }catch(error){
        console.log("unexpected error during logout",error)
        res.redirect("/pageerror")
    }
}

module.exports = {
    loadLogin,
    login,
    pageerror,
    loadDashboard,
    logout
}