import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
import Category from '../../models/categorySchema.js';
import { populate } from 'dotenv';

class AllProductsService {
    // Get products for listing page with filters, sorting, and pagination
    getAllProducts = async ({
        page,
        limit,
        search,
        category,
        brand,
        minPrice,
        maxPrice,
        sort
    }) => {
        //  Build a simple product query
        const productQuery = { isBlocked: false };

        if (search) {
            productQuery.name = { $regex: search, $options: 'i' };
        }

        if (category) {
            productQuery.category = category;
        }

        if (brand) {
            productQuery.brand = brand;
        }

        // 2) Fetch products with brand + category details
        const products = await Product.find(productQuery)
            .populate('brand', 'name')
            .populate('category', 'name')
            .lean();

        // 3) Build product cards using the cheapest active variant
        const cards = [];

        for (const product of products) {
            // Active variants that are in stock
            let variants = await ProductVariant.find({
                productId: product._id,
                isActive: true,
                stock: { $gt: 0 }
            }).lean();

            if (!variants.length) continue;

            // 4) Apply price filter on variants
            const min = minPrice ? Number(minPrice) : null;
            const max = maxPrice ? Number(maxPrice) : null;

            if (min !== null || max !== null) {
                variants = variants.filter(v => {
                    if (min !== null && v.price < min) return false;
                    if (max !== null && v.price > max) return false;
                    return true;
                });
            }

            if (!variants.length) continue;

            // 5) Pick the lowest priced variant
            variants.sort((a, b) => a.price - b.price);
            const cheapest = variants[0];

            cards.push({
                _id: product._id,
                name: product.name,
                brandName: product.brand?.name || 'N/A',
                image: cheapest.images?.[0] || '',
                price: cheapest.price || 0,
                variantId: cheapest._id
            });
        }

        // 6) Sort products
        if (sort === 'lowToHigh') {
            cards.sort((a, b) => a.price - b.price);
        } else if (sort === 'highToLow') {
            cards.sort((a, b) => b.price - a.price);
        } else if (sort === 'aToZ') {
            cards.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === 'zToA') {
            cards.sort((a, b) => b.name.localeCompare(a.name));
        }

        // 7) Pagination (simple slice)
        const total = cards.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginated = cards.slice(start, end);

        return {
            products: paginated,
            totalPages
        };
    };

    // Get category list for sidebar
    getCategories = async () => {
        return Category.find({ isListed: true }).select('name').lean();
    };

    // Get brand list from products (no Brand model needed)
    getBrands = async () => {
        const products = await Product.find({ brand: { $ne: null } })
            .populate('brand', 'name')
            .lean();

        const map = new Map();

        products.forEach(p => {
            if (p.brand?._id) {
                map.set(p.brand._id.toString(), {
                    _id: p.brand._id,
                    name: p.brand.name
                });
            }
        });

        return Array.from(map.values());
    };

    // Get a product with its active variants (for product details page)
    getProductDetails = async (productId) => {
        const product = await Product.findById(productId)
            .populate('brand', 'name')
            .populate('category', 'name')
            .lean();

        if (!product) return null;
        if (product.isBlocked) return { product, variants: [] };

        const variants = await ProductVariant.find({
            productId: product._id,
            isActive: true
        }).lean();

        return { product, variants };
    };

    // Get related products from the same category (max 4)
    getRelatedProducts = async (productId, categoryId) => {
        const products = await Product.find({
            _id: { $ne: productId },
            category: categoryId,
            isBlocked: false
        })
            .populate('brand', 'name')
            .lean();

        const related = [];
console.log('CATEGORY:', categoryId);

        for (const product of products) {
            const variants = await ProductVariant.find({
                productId: product._id,
                isActive: true
            }).lean();

            if (!variants.length) continue;

            variants.sort((a, b) => a.price - b.price);
            const cheapest = variants[0];

            related.push({
                _id: product._id,
                name: product.name,
                brandName: product.brand?.name || 'N/A',
                image: cheapest.images?.[0] || '',
                price: cheapest.price || 0
            });
        }

        return related.slice(0, 4);
    };
}

export default new AllProductsService();