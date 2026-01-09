import ProductService from '../../service/admin/productService.js';
import BrandService from '../../service/admin/brandService.js'
import CategoryService from '../../service/admin/categoryService.js'
import logger from '../../logger.js'



class ProductController {
  // Load products list page
  loadProductsPage = async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 10;
      const search = req.query.search || '';
      const brand = req.query.brand || '';
      const category = req.query.category || '';

      const result = await ProductService.getProducts({
        page,
        limit,
        search,
        brand,
        category
      });

      //const { brands, categories } = await ProductService.getBrandsAndCategories();
      const categories = await CategoryService.getAllCategories();
      const brands = await BrandService.getAllBrands();

      res.render('product', {
        products: result.products,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        search,
        brand,
        category,
        brands,
        categories
      });
    } catch (error) {
      logger.error('Error loading products page:', error);
      res.redirect('/admin/pageerror');
    }
  };

  loadAddProduct = async (req, res) => {
    const data = await ProductService.getBrandsAndCategories();
    res.render("addProduct", data);
  };

   addProduct = async (req, res) => {
    try {
      await ProductService.createProduct(req.body, req.files);
      res.json({ success: true, message: "Product added successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  };
}
export default new ProductController()