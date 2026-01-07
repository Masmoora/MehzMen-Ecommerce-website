import express from 'express';
const router = express.Router();
import adminController from '../controllers/admin/adminController.js';
import AuthMiddleware from '../middlewares/auth.js';
import customerController from '../controllers/admin/customerController.js'
import categoryController from '../controllers/admin/categoryController.js'
import brandController from '../controllers/admin/brandController.js'
import categoryUpload from '../middlewares/multer.js';
import brandUpload from '../middlewares/brandUpload.js';

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
//Category management
router.get('/category',AuthMiddleware.adminAuth,categoryController.loadCategories)
router.post('/categories/addCategory',AuthMiddleware.adminAuth,categoryUpload.single("image"),categoryController.addCategory)
router.post('/categories/editCategory',AuthMiddleware.adminAuth,categoryUpload.single("image"),categoryController.editCategory)
router.post(
  '/categories/list',
  AuthMiddleware.adminAuth,
  categoryController.listCategory
);

router.post(
  '/categories/unlist',
  AuthMiddleware.adminAuth,
  categoryController.unlistCategory
);
//brand Management
router.get('/brands',AuthMiddleware.adminAuth,brandController.loadBrands)
router.post('/addBrand',AuthMiddleware.adminAuth,brandUpload.single("logo"),brandController.addBrand)
router.post('/editBrand',AuthMiddleware.adminAuth,brandUpload.single("logo"),brandController.editBrand)
router.patch(
  "/brands/toggle/:id",AuthMiddleware.adminAuth,
  brandController.toggleBrandStatus
);


export default router;