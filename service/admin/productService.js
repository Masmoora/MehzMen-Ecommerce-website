import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVariantSchema.js';
import Offer from '../../models/offerSchema.js'
import { getBestOffer } from '../../utils/offerHelper.js'

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
    const productIds = products.map(p => p._id);

  const offers = await Offer.find({
    offerType: "product",
    productId: { $in: productIds }
  }).lean();

  products.forEach(product => {
    product.hasOffer = offers.some(
      offer => offer.productId.toString() === product._id.toString()
    );
  })

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  };

  /*getBrandsAndCategories = async () => {
    const brands = await Brand.find({ isBlocked: false }).lean();
    const categories = await Category.find({ isBlocked: false }).lean();
    return { brands, categories };
  };*/

  createProduct = async (body, files) => {
    const { name, description, brand, category, status, variants } = body;

    if (!name || !brand || !category || !status) {
      throw new Error('Missing required product fields');
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      throw new Error('At least one variant is required');
    }
    //  Normalize product name
    const normalizedName = name.trim().replace(/\s+/g, ' ');

    //  Check for existing product (case-insensitive)
    const existingProduct = await Product.findOne({
      name: { $regex: `^${normalizedName}$`, $options: 'i' }
    });

    if (existingProduct) {
      throw new Error('Product already exists');
    }
    //  Create Product FIRST
    const product = await Product.create({
      name,
      description,
      brand,
      category,
      status
    });

    //  Prepare Variants
    const variantDocs = [];

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];

      const variantImages = files.filter(
        f => f.fieldname === `variants[${i}][images]`
      );

      if (variantImages.length < 3) {
        throw new Error(`Variant ${i + 1} must have at least 3 images`);
      }

      variantDocs.push({
        productId: product._id,
        size: v.size,
        color: v.color,
        price: Number(v.price),
        stock: Number(v.stock),
        sku: v.sku,
        isActive: v.isActive === 'true',
        images: variantImages.map(img => img.location)
      });
    }

    //  SAVE VARIANTS (THIS CREATES THE COLLECTION )
    await ProductVariant.insertMany(variantDocs);

    return product;
  };
  getProductWithVariants = async (productId) => {
    const product = await Product.findById(productId).lean();
    if (!product) {
      throw new Error('Product not found');
    }

    const variants = await ProductVariant.find({ productId }).lean();

    return { product, variants };
  };
  // Get single variant by ID
  getVariantById = async (variantId) => {
    const variant = await ProductVariant.findById(variantId).lean();
    if (!variant) {
      throw new Error('Variant not found');
    }

    return variant;
  };
  // Update variant
  updateVariant = async (variantId, data, files = []) => {
    const updateData = {
      size: data.size,
      color: data.color,
      price: Number(data.price),
      stock: Number(data.stock),
      sku: data.sku,
      isActive: data.isActive === 'true' || data.isActive === true
    };

    // If new images uploaded
    if (files.length > 0) {
      const imageUrls = files.map(file => file.location);

      if (imageUrls.length < 3) {
        throw new Error('Variant must have at least 3 images');
      }

      updateData.images = imageUrls;
    }

    const updated = await ProductVariant.findByIdAndUpdate(
      variantId,
      updateData,
      { new: true }
    );

    if (!updated) {
      throw new Error('Variant not found');
    }

    return updated;
  };

  // Get product by ID with populated fields
  getProductById = async (id) => {
    try {
      const product = await Product.findById(id)
        .populate('brand', 'name')
        .populate('category', 'name')
        .lean();
      return product;
    } catch (error) {
      throw error;
    }
  };

  // Get variants for a product
  getProductVariants = async (productId) => {
    try {
      const variants = await ProductVariant.find({ productId })
        .sort({ createdAt: -1 })
        .lean();
      return variants;
    } catch (error) {
      throw error;
    }
  };

  // Update product
  updateProduct = async (productId, productData) => {
    try {
      const product = await Product.findByIdAndUpdate(
        productId,
        productData,
        { new: true, runValidators: true }
      );
      return product;
    } catch (error) {
      throw error;
    }
  };
  // Toggle product block status
  toggleProductBlock = async (productId) => {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      product.isBlocked = !product.isBlocked;
      await product.save();
      return product;
    } catch (error) {
      throw error;
    }
  };

  // Update existing variant (full update - replaces images)
  updateVariant = async (variantId, variantData) => {
    try {
      // Validate minimum 3 images
      if (variantData.images && variantData.images.length < 1) {
        throw new Error('Each variant must have at least 3 images');
      }

      const variant = await ProductVariant.findByIdAndUpdate(
        variantId,
        variantData,
        { new: true, runValidators: true }
      );
      return variant;
    } catch (error) {
      throw error;
    }
  };

  // Update variant fields while preserving existing images
  updateVariantFields = async (variantId, variantData) => {
    try {
      const variant = await ProductVariant.findById(variantId);

      if (!variant) {
        throw new Error('Variant not found');
      }

      // Update fields (excluding images - handled separately)
      const { images, ...fieldsToUpdate } = variantData;
      Object.assign(variant, fieldsToUpdate);

      await variant.save();
      return variant;
    } catch (error) {
      throw error;
    }
  };

  // Add new variant
  addVariant = async (variantData) => {
    try {
      // Validate minimum 3 images
      if (!variantData.images || variantData.images.length < 3) {
        throw new Error('Each variant must have at least 3 images');
      }

      const variant = new ProductVariant(variantData);
      await variant.save();
      return variant;
    } catch (error) {
      throw error;
    }
  };

  // Delete variant image
  deleteVariantImage = async (variantId, imageUrl) => {
    try {
      const variant = await ProductVariant.findById(variantId);

      if (!variant) {
        throw new Error('Variant not found');
      }

      // Check if variant has more than 3 images
      if (variant.images.length <= 1) {
        throw new Error('Cannot delete image. Each variant must have at least 3 images');
      }

      // Remove the image from array
      variant.images = variant.images.filter(img => img !== imageUrl);
      await variant.save();

      return variant;
    } catch (error) {
      throw error;
    }
  };
  // Replace one variant image with a new one (keeps same count)
  replaceVariantImage = async (variantId, imageUrlToReplace, newImageUrl) => {
    try {
      const variant = await ProductVariant.findById(variantId);
      if (!variant) throw new Error('Variant not found');
      if (!variant.images.includes(imageUrlToReplace)) throw new Error('Image not found in variant');
      variant.images = variant.images.map(url => (url === imageUrlToReplace ? newImageUrl : url));
      await variant.save();
      return variant;
    } catch (error) {
      throw error;
    }
  };
  // Add images to variant
  addVariantImages = async (variantId, newImageUrls) => {
    try {
      const variant = await ProductVariant.findById(variantId);

      if (!variant) {
        throw new Error('Variant not found');
      }

      // Append new images to existing ones
      variant.images = [...variant.images, ...newImageUrls];
      await variant.save();

      return variant;
    } catch (error) {
      throw error;
    }
  };
  // Get variant by ID
  getVariantById = async (variantId) => {
    try {
      const variant = await ProductVariant.findById(variantId).lean();
      return variant;
    } catch (error) {
      throw error;
    }
  };
  async getProductOffer(productId){

    return await Offer.findOne({
      productId,
      offerType:"product"
    })

  }


  async createProductOffer(data){

    const existing = await Offer.findOne({
      productId:data.productId
    })

    if(existing){
      throw new Error("Offer already exists")
    }

    const offer = new Offer({

      offerType:"product",

      productId:data.productId,

      offerTitle:data.offerTitle,

      discountType:data.discountType,

      discountValue:data.discountValue,

      startDate:data.startDate,

      endDate:data.endDate

    })

    await offer.save()

    return offer

  }



  async updateProductOffer(productId,data){

    const offer = await Offer.findOne({productId,
      offerType:"product"
    })

    if(!offer){
      throw new Error("Offer not found")
    }

    offer.offerTitle = data.offerTitle
    offer.discountType = data.discountType
    offer.discountValue = data.discountValue
    offer.startDate = data.startDate
    offer.endDate = data.endDate

    await offer.save()

    return offer

  }



  async deleteProductOffer(productId){

    return await Offer.deleteOne({productId,
      offerType:"product"
    })

  }
//offer
getBestVariantPricing = async (product, variants) => {
  const now = new Date();
  const commonFilter = {
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  };
  const categoryId = product.category?._id || product.category || null;

  const [productOffer, categoryOffer] = await Promise.all([
    Offer.findOne({ ...commonFilter, offerType: 'product', productId: product._id }).lean(),
    categoryId
      ? Offer.findOne({ ...commonFilter, offerType: 'category', categoryId }).lean()
      : Promise.resolve(null)
  ]);

  return variants.map((v) => {
    const best = getBestOffer(v.price, productOffer, categoryOffer);
    const discountPercent =
      best.discountAmount > 0 && best.originalPrice > 0
        ? Math.round((best.discountAmount / best.originalPrice) * 100)
        : 0;

    return { ...v, originalPrice: best.originalPrice, finalPrice: best.finalPrice,
             discountAmount: best.discountAmount, discountPercent, appliedOfferType: best.appliedOfferType };
  });
};

};
export default new ProductService();