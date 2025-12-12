import express from 'express';
const router = express.Router();
import adminController from '../controllers/admin/adminController.js';
import AuthMiddleware from '../middlewares/auth.js';

router.get('/pageerror',adminController.pageerror);
router.get('/login',AuthMiddleware.isAdminLogin,adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/dashboard',AuthMiddleware.adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout);

export default router;