import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
import Category from '../../models/categorySchema.js';
import { populate } from 'dotenv';
import offerController from '../../controllers/admin/offerController.js';
import Offer from '../../models/offerSchema.js'
import Wishlist from '../../models/wishlistSchema.js';
import { getBestOffer } from '../../utils/offerHelper.js'

class AllProductsService {

    getWishlistProductIds = async (userId) => {
  if (!userId) return [];

  const wishlist = await Wishlist.findOne({ userId })
    .select('products.productId')
    .lean();

  if (!wishlist) return [];

  return wishlist.products.map(item => item.productId.toString());
};
    // Get products for listing page with filters, sorting, and pagination
    getAllProducts = async ({
        page,
        limit,
        search,
        category,
        brand,
        minPrice,
        maxPrice,
        sort,
        color
    }) => {
        //offer
        const now = new Date();
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
            // 4) Apply color filter on variants
            if (color) {
                const normalizedColor = color.toLowerCase();
                variants = variants.filter(v => (v.color || '').toLowerCase() === normalizedColor);
            }

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

            // Fetch offers for this product/category
            const commonFilter = {
                status: 'active',
                startDate: { $lte: now },
                endDate: { $gte: now }
            };

            const categoryId = product.category?._id || product.category || null;

            const [productOffer, categoryOffer] = await Promise.all([
                Offer.findOne({
                    ...commonFilter,
                    offerType: 'product',
                    productId: product._id
                }).lean(),
                categoryId
                    ? Offer.findOne({
                        ...commonFilter,
                        offerType: 'category',
                        categoryId
                    }).lean()
                    : Promise.resolve(null)
            ]);

            const best = getBestOffer(cheapest.price, productOffer, categoryOffer);
            const discountPercent =
                best.discountAmount > 0 && best.originalPrice > 0
                    ? Math.round((best.discountAmount / best.originalPrice) * 100)
                    : 0;


            cards.push({
                _id: product._id,
                name: product.name,
                brandName: product.brand?.name || 'N/A',
                image: cheapest.images?.[0] || '',
                price: best.finalPrice || 0,
                variantId: cheapest._id,
                originalPrice: best.originalPrice,
                discountAmount: best.discountAmount,
                discountPercent,
                appliedOfferType: best.appliedOfferType
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
    // Get colors list from active variants
    getColors = async () => {
        const colors = await ProductVariant.distinct('color', {
            isActive: true,
            stock: { $gt: 0 }
        });
        return colors
            .filter(Boolean)
            .map(color => color.trim())
            .filter(color => color.length > 0)
            .sort((a, b) => a.localeCompare(b));
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

        //Offer

        const now = new Date();
        const commonFilter = {
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        };

        const categoryId = product.category?._id || product.category || null;

        const [productOffer, categoryOffer] = await Promise.all([
            Offer.findOne({
                ...commonFilter,
                offerType: 'product',
                productId: product._id
            }).lean(),
            categoryId
                ? Offer.findOne({
                    ...commonFilter,
                    offerType: 'category',
                    categoryId
                }).lean()
                : Promise.resolve(null)
        ]);
        const enrichedVariants = variants.map((variant) => {
            const best = getBestOffer(variant.price, productOffer, categoryOffer);
            const discountPercent =
                best.discountAmount > 0 && best.originalPrice > 0
                    ? Math.round((best.discountAmount / best.originalPrice) * 100)
                    : 0;

            return {
                ...variant,
                originalPrice: best.originalPrice,
                finalPrice: best.finalPrice,
                discountAmount: best.discountAmount,
                discountPercent,
                appliedOfferType: best.appliedOfferType
            };
        });
        return { product, variants: enrichedVariants };;
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
            //offer
            const now = new Date();
            const commonFilter = { status: 'active', startDate: { $lte: now }, endDate: { $gte: now } }; 
            const [productOffer, categoryOffer] = await Promise.all([Offer.findOne({ ...commonFilter, offerType: 'product', productId: product._id }).lean(), categoryId ? Offer.findOne({ ...commonFilter, offerType: 'category', categoryId: categoryId }).lean() : Promise.resolve(null)]); 
            const best = getBestOffer(cheapest.price, productOffer, categoryOffer);
            

            related.push({
                _id: product._id,
                name: product.name,
                brandName: product.brand?.name || 'N/A',
                image: cheapest.images?.[0] || '',
               // price: cheapest.price || 0
                price: best.finalPrice || 0//offer
            });
        }

        return related.slice(0, 4);
    };
}

export default new AllProductsService();