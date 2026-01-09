import Product from '../../models/productSchema.js';
import Brand from '../../models/brandSchema.js';
import Category from '../../models/categorySchema.js';

class ProductService {
    // Get paginated products with filters
    getProducts = async ({ page = 1, limit = 10, search = '', brand = '', category = '' }) => {
        const skip = (page - 1) * limit;
        const filter = {};

        if (search && search.trim()) {
            filter.name = { $regex: search.trim(), $options: 'i' };
        }

        if (brand) {
            filter.brand = brand;
        }

        if (category) {
            filter.category = category;
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('brand', 'name')
                .populate('category', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(filter)
        ]);

        return {
            products,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit))
        };
    };

getBrandsAndCategories = async () => {
  const brands = await Brand.find({ isBlocked: false }).lean();
  const categories = await Category.find({ isBlocked: false }).lean();
  return { brands, categories };
};


    
createProduct = async (body, files) => {
  if (!body.variants || !Object.keys(body.variants).length) {
    throw new Error("At least one variant is required");
  }

  let totalImages = 0;
  const variants = [];

  for (const index in body.variants) {
    const variantImages = files
      .filter(f => f.fieldname === `variants[${index}][images]`)
      .map(f => `/uploads/products/${f.filename}`);

    totalImages += variantImages.length;

    variants.push({
      size: body.variants[index].size,
      color: body.variants[index].color,
      stock: Number(body.variants[index].stock),
      images: variantImages,
      isActive: true
    });
  }

  if (totalImages < 3) {
    throw new Error("Minimum 3 images required for product");
  }

  const product = await Product.create({
    name: body.name,
    description: body.description,
    brand: body.brand,
    category: body.category,
    status: body.status,
    price: Number(body.price),
    offerPrice: Number(body.price), // can be recalculated later
    variants,
    isActive: true
  });

  return product;
};



};
export default new ProductService();