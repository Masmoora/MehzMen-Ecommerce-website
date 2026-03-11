import express from 'express';
const router = express.Router();
import adminController from '../controllers/admin/adminController.js';
import AuthMiddleware from '../middlewares/auth.js';
import customerController from '../controllers/admin/customerController.js';
import categoryController from '../controllers/admin/categoryController.js';
import brandController from '../controllers/admin/brandController.js';
import productController from '../controllers/admin/productController.js';
import AdminOrderController from '../controllers/admin/orderController.js'
//import categoryUpload from '../middlewares/multer.js';
import s3Upload from '../middlewares/multer.js';
import CouponController from '../controllers/admin/couponController.js';

router.get('/pageerror',adminController.pageerror);
//Login Management
router.get('/login',AuthMiddleware.isAdminLogin,adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/dashboard',AuthMiddleware.adminAuth,adminController.loadDashboard);
router.get('/logout', AuthMiddleware.adminAuth,adminController.logout);
//customer management
router.get('/customers',AuthMiddleware.adminAuth,customerController.loadCustomers);
router.get('/blockCustomer',AuthMiddleware.adminAuth,customerController.blockCustomer);
router.get('/unblockCustomer',AuthMiddleware.adminAuth,customerController.unblockCustomer);
//Category management
router.get('/category',AuthMiddleware.adminAuth,categoryController.loadCategories);
router.post('/categories/addCategory',AuthMiddleware.adminAuth,s3Upload('categories').single('image'),categoryController.addCategory);
router.post('/categories/editCategory',AuthMiddleware.adminAuth,s3Upload('categories').single('image'),categoryController.editCategory);
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
router.get('/brands',AuthMiddleware.adminAuth,brandController.loadBrands);
router.post('/addBrand',AuthMiddleware.adminAuth,s3Upload('brands').single('logo'),brandController.addBrand);
router.post('/editBrand',AuthMiddleware.adminAuth,s3Upload('brands').single('logo'),brandController.editBrand);
router.patch(
  '/brands/toggle/:id',AuthMiddleware.adminAuth,
  brandController.toggleBrandStatus
);
//product Management

router.get(
  '/products',
  AuthMiddleware.adminAuth,
  productController.loadProductsPage
);
// Toggle product block/unblock
router.patch('/products/:id/block',AuthMiddleware.adminAuth, productController.toggleProductBlock);
router.get(
  '/addProducts',
  AuthMiddleware.adminAuth,
  productController.loadAddProduct
);
router.post(
  '/addProducts',
  AuthMiddleware.adminAuth, s3Upload('products').any(),
  productController.addProduct
);

router.get(
  '/products/:id/variants',
  AuthMiddleware.adminAuth,
  productController.viewVariants
);
//edit variants
router.get(
  '/variants/:id/edit',
  AuthMiddleware.adminAuth,
  productController.editVariantPage
);

router.post(
  '/variants/:id/edit',
  AuthMiddleware.adminAuth,
  s3Upload('products').any(),
  productController.updateVariant
);

//
router.get('/products/:id/edit',AuthMiddleware.adminAuth, productController.loadEditProduct);

// Update product

router.post('/products/update/:id',AuthMiddleware.adminAuth,s3Upload('products').any(), productController.updateProduct);

// Delete variant image (AJAX endpoint)
router.post('/products/variant/image/delete', AuthMiddleware.adminAuth,s3Upload('products').any(),productController.deleteVariantImage);
// View variants page
router.get('/products/:id/variants', productController.loadViewVariants);

// Toggle variant status (AJAX endpoint)
router.post('/products/variant/toggle-status',  AuthMiddleware.adminAuth,productController.toggleVariantStatus);

// Update variant (AJAX endpoint)
router.post('/products/variant/update',  AuthMiddleware.adminAuth,
  s3Upload('products').any(),productController.updateVariant);
//order Management
router.get('/orders', AuthMiddleware.adminAuth, AdminOrderController.loadOrders);
router.get('/orders/:orderId',  AuthMiddleware.adminAuth, AuthMiddleware.adminAuth,AdminOrderController.loadOrderDetails);
router.patch('/orders/:orderId/status', AuthMiddleware.adminAuth,AdminOrderController.updateOrderStatus);
router.patch('/orders/:orderId/cancel', AdminOrderController.cancelOrder);
router.patch('/orders/:orderId/items/:itemId/status', AdminOrderController.updateItemStatus);
router.patch('/orders/:orderId/items/:itemId/cancel', AdminOrderController.cancelItem);
router.patch('/orders/:orderId/items/:itemId/approve-return', AdminOrderController.approveReturn);
router.patch('/orders/:orderId/items/:itemId/reject-return', AdminOrderController.rejectReturn);
router.patch('/orders/:orderId/items/:itemId/mark-returned', AdminOrderController.markReturned);
router.get('/orders/:orderId/invoice', AdminOrderController.downloadInvoice);

//coupon management
router.get('/coupons', CouponController.loadCoupons);
router.get('/coupons/add', CouponController.loadAddCoupon);
router.post('/coupons/add', CouponController.createCoupon);
router.get('/coupons/edit/:id', CouponController.loadEditCoupon);
router.post('/coupons/edit/:id', CouponController.updateCoupon);
router.delete('/coupons/delete/:id', CouponController.deleteCoupon);
export default router;