import express from 'express';
const router = express.Router();
import adminController from '../controllers/admin/adminController.js';
import AuthMiddleware from '../middlewares/auth.js';
import customerController from '../controllers/admin/customerController.js'

router.get('/pageerror',adminController.pageerror);
//Login Management
router.get('/login',AuthMiddleware.isAdminLogin,adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/dashboard',AuthMiddleware.adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout);
//customer management
router.get('/customers',AuthMiddleware.adminAuth,customerController.loadCustomers)
router.get('/blockCustomer',AuthMiddleware.adminAuth,customerController.blockCustomer)
router.get('/unblockCustomer',AuthMiddleware.adminAuth,customerController.unblockCustomer)

export default router;