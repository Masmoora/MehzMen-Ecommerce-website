const express=require('express')
const router=express.Router()
const adminController=require('../controllers/admin/adminController')
const{adminAuth,isAdminLogin}=require('../middlewares/auth')

router.get('/pageerror',adminController.pageerror)
router.get('/login',isAdminLogin,adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminController.loadDashboard)
router.get('/logout',adminController.logout)









module.exports=router