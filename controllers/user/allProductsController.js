
import AllProductsService from '../../service/user/allProductService.js';
import logger from '../../logger.js';


class AllProductsController {
    // List all products page
    loadAllProducts = async (req, res) => {
        try {
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = 5;
            const search = (req.query.search || '').trim();
            const category = req.query.category || '';
            const brand = req.query.brand || '';
            const minPrice = req.query.minPrice || '';
            const maxPrice = req.query.maxPrice || '';
            const sort = req.query.sort || '';

            const { products, totalPages } = await AllProductsService.getAllProducts({
                page,
                limit,
                search,
                category,
                brand,
                minPrice,
                maxPrice,
                sort
            });

            const [categories, brands] = await Promise.all([
                AllProductsService.getCategories(),
                AllProductsService.getBrands()
            ]);

            const user = req.session?.user || null;

            res.render('allProducts', {
                user,
                products,
                categories,
                brands,
                page,
                totalPages,
                search,
                selectedCategory: category,
                selectedBrand: brand,
                minPrice,
                maxPrice,
                sort
            });
        } catch (error) {
            logger.error('Error loading all products page:', error);
            res.status(500).render('pageerror');
        }
    };
    // Product details page
    loadProductDetails = async (req, res) => {
        try {
            const productId = req.params.id;
            const data = await AllProductsService.getProductDetails(productId);

            if (!data || !data.product) {
                return res.redirect('/allProducts');
            }

            const { product, variants } = data;

            // If product is blocked or no active variants, redirect
            if (product.isBlocked || !variants.length) {
                return res.redirect('/allProducts');
            }

            const relatedProducts = await AllProductsService.getRelatedProducts(
                product._id,
               product.category._id 
           );


            const user = req.session?.user || null;

            res.render('productDetail', {
                user,
                product,
                variants,
                relatedProducts
            });
        } catch (error) {
            logger.error('Error loading product details:', error);
            res.redirect('/allProducts');
        }
    };
}

export default new AllProductsController();