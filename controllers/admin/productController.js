import ProductService from '../../service/admin/productService.js';
import BrandService from '../../service/admin/brandService.js';
import CategoryService from '../../service/admin/categoryService.js';
import logger from '../../logger.js';

class ProductController {
  // Load products list page
  loadProductsPage = async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 2;
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
    try {
      const categories = await CategoryService.getAllCategories();
      const brands = await BrandService.getAllBrands();
      res.render('addProduct', { brands, categories });
    } catch {
      logger.error('Error loading products page:', error);
      res.redirect('/admin/pageerror');
    }
  };

  addProduct = async (req, res) => {
    try {
      console.log('BODY:', req.body);
      console.log('FILES:', req.files);

      await ProductService.createProduct(req.body, req.files);
      return res.status(200).json({
        success: true,
        message: 'Product added successfully'
      });
    } catch (err) {
      console.error(err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  };
  viewVariants = async (req, res) => {
    try {
      const { product, variants } =
        await ProductService.getProductWithVariants(req.params.id);

      res.render('viewVariants', {
        product,
        variants
      });
    } catch (err) {
      console.error(err.message);
      res.redirect('/admin/pageerror');
    }
  };
  editVariantPage = async (req, res) => {
    try {
      const variant =
        await ProductService.getVariantById(req.params.id);

      res.render('admin/editVariant', { variant });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/pageerror');
    }
  };
  updateVariant = async (req, res) => {
    try {
      await ProductService.updateVariant(
        req.params.id,
        req.body,
        req.files
      );

      res.json({ success: true, message: 'Variant updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(400).json({ success: false, message: err.message });
    }
  };

  editProductPage = async (req, res) => {
    try {
      const productId = req.params.id;

      const data = await ProductService.getEditProductData(productId);
      console.log('PRODUCT BRAND:', data.product.brand);
      console.log('ALL BRANDS:', data.brands);

      res.render('editProduct', {
        product: data.product,
        variants: data.variants,
        brands: data.brands,
        categories: data.categories
      });
    } catch (error) {
      console.error('Edit Page Error:', error);
      res.redirect('/admin/pageerror');
    }
  };

  // Load edit product page
  loadEditProduct = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.redirect('/admin/products?error=invalid_id');
      }

      // Get product with populated fields
      const product = await ProductService.getProductById(id);

      if (!product) {
        return res.redirect('/admin/products?error=not_found');
      }

      // Get variants for this product
      const variants = await ProductService.getProductVariants(id);

      // Get brands and categories for dropdowns

      const [brands, categories] = await Promise.all([
        BrandService.getAllBrands(),
        CategoryService.getAllCategories()
      ]);

      res.render('editProduct', {
        product,
        variants,
        brands,
        categories
      });
    } catch (error) {
      logger.error('Error loading edit product page:', error);
      return res.redirect('/admin/products?error=load_failed');
    }
  };

  // Update product

  updateProduct = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, brand, category, status } = req.body;

      // Validate required fields
      if (!name || !description || !brand || !category || !status) {
        return res.status(400).json({
          success: false,
          message: 'All required fields must be filled'
        });
      }

      // Update product details
      const productData = {
        name: name.trim(),
        description: description.trim(),
        brand,
        category,
        status
      };

      await ProductService.updateProduct(id, productData);

      // Parse variants from request body
      // Variants come as arrays: variants[0][size], variants[0][color], etc.
      //const variants = req.body.variants || [];
      const variantMap = {};

      if (req.body.variants) {
        if (Array.isArray(req.body.variants)) {
          req.body.variants.forEach((variant, index) => {
            variantMap[index] = variant;
          });
        } else if (typeof req.body.variants === 'object') {
          Object.keys(req.body.variants).forEach(index => {
            variantMap[index] = req.body.variants[index];
          });
        }
      }

      // Fallback for flat key format
      if (Object.keys(variantMap).length === 0) {
        Object.keys(req.body).forEach(key => {
          const match = key.match(/^variants\[(\d+)\]\[(.+)\]$/);
          if (match) {
            const index = match[1];
            const field = match[2];
            if (!variantMap[index]) variantMap[index] = {};
            variantMap[index][field] = req.body[key];
          }
        });
      }
      // Process each variant
      for (const index in variantMap) {
        const variantData = variantMap[index];
        const variantId = variantData.variantId;

        if (variantId) {
          // Update existing variant fields
          const updateData = {
            size: variantData.size,
            color: variantData.color,
            price: parseFloat(variantData.price),
            stock: parseInt(variantData.stock),
            isActive: variantData.isActive === 'true'
          };

          // Handle SKU if exists
          if (variantData.sku) {
            updateData.sku = variantData.sku.trim();
          }

          await ProductService.updateVariantFields(variantId, updateData);

          // Handle new images for this variant (from req.files)
          // Images are uploaded via multer-s3 and available in req.files
          // Format: req.files['variants[0][images]'] or similar
          // This depends on  multer-s3 configuration
          const newImageUrls = [];
          if (req.files) {
            const variantImages = req.files.filter(file => {
              // Match files for this variant index
              // Adjust based on how multer-s3 names your files
              return file.fieldname && file.fieldname.includes(`variants[${index}]`);
            });

            variantImages.forEach(file => {
              // file.location is the S3 URL when using multer-s3
              if (file.location) {
                newImageUrls.push(file.location);
              }
            });
          }

          // Append new images to existing ones
          // Validate final image count (existing + new)
          const existingVariant = await ProductService.getVariantById(variantId);
          const existingCount = existingVariant?.images?.length || 0;
          const finalCount = existingCount + newImageUrls.length;

          if (finalCount < 3) {
            return res.status(400).json({
              success: false,
              message: `Variant ${parseInt(index) + 1} must have at least 3 images`
            });
          }
          if (newImageUrls.length > 0) {
            await ProductService.addVariantImages(variantId, newImageUrls);
          }
        } else {
          // New variant - create with images
          const newVariantData = {
            productId: id,
            size: variantData.size,
            color: variantData.color,
            price: parseFloat(variantData.price),
            stock: parseInt(variantData.stock),
            isActive: variantData.isActive === 'true',
            images: []
          };

          if (variantData.sku) {
            newVariantData.sku = variantData.sku.trim();
          }

          // Get images for this new variant
          const newImageUrls = [];
          if (req.files) {
            const variantImages = req.files.filter(file => {
              return file.fieldname && file.fieldname.includes(`variants[${index}]`);
            });

            variantImages.forEach(file => {
              if (file.location) {
                newImageUrls.push(file.location);
              }
            });
          }

          if (newImageUrls.length < 3) {
            return res.status(400).json({
              success: false,
              message: `Variant ${parseInt(index) + 1} must have at least 3 images`
            });
          }

          newVariantData.images = newImageUrls;
          await ProductService.addVariant(newVariantData);
        }
      }

      res.json({
        success: true,
        message: 'Product updated successfully'
      });
    } catch (error) {
      logger.error('Error updating product:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update product'
      });
    }
  };
  // Toggle product block/unblock
  toggleProductBlock = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const updatedProduct = await ProductService.toggleProductBlock(id);

      res.json({
        success: true,
        message: updatedProduct.isBlocked ? 'Product blocked successfully' : 'Product unblocked successfully',
        isBlocked: updatedProduct.isBlocked
      });
    } catch (error) {
      logger.error('Error toggling product block status:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update product status'
      });
    }
  };

  // Delete variant image (AJAX endpoint)
  deleteVariantImage = async (req, res) => {
    try {
      const { variantId, imageUrl } = req.body;

      if (!variantId || !imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Variant ID and image URL are required'
        });
      }

      await ProductService.deleteVariantImage(variantId, imageUrl);

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting variant image:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete image'
      });
    }
  };
  // Replace variant image (AJAX endpoint) – one image swapped for a new upload
 // Replace variant image (AJAX endpoint) – one image swapped for a new upload
  replaceVariantImage = async (req, res) => {
    try {
      const { variantId, imageUrl } = req.body;

      if (!variantId || !imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Variant ID and image URL are required'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'New image file is required'
        });
      }

      // Support S3 (file.location), local disk (file.path), or custom URL (file.url)
      const newImageUrl = req.file.location ;

      if (!newImageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Could not determine URL for uploaded image'
        });
      }

      await ProductService.replaceVariantImage(variantId, imageUrl, newImageUrl);

      res.json({
        success: true,
        message: 'Image replaced successfully',
        newImageUrl
      });
    } catch (error) {
      logger.error('Error replacing variant image:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to replace image'
      });
    }
  };

  // Load view variants page
  loadViewVariants = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.redirect('/admin/products?error=invalid_id');
      }

      // Get product with populated fields
      const product = await ProductService.getProductById(id);

      if (!product) {
        return res.redirect('/admin/products?error=not_found');
      }

      // Get variants for this product
      const variants = await ProductService.getProductVariants(id);

      res.render('admin/viewVariants', {
        product,
        variants
      });
    } catch (error) {
      logger.error('Error loading view variants page:', error);
      return res.redirect('/admin/products?error=load_failed');
    }
  };

  // Toggle variant active status (AJAX endpoint)
  toggleVariantStatus = async (req, res) => {
    try {
      const { variantId } = req.body;

      if (!variantId) {
        return res.status(400).json({
          success: false,
          message: 'Variant ID is required'
        });
      }

      const variant = await ProductService.getVariantById(variantId);

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found'
        });
      }

      // Toggle isActive status
      const updateData = { isActive: !variant.isActive };
      await ProductService.updateVariantFields(variantId, updateData);

      res.json({
        success: true,
        message: `Variant ${updateData.isActive ? 'activated' : 'deactivated'} successfully`,
        isActive: updateData.isActive
      });
    } catch (error) {
      logger.error('Error toggling variant status:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to toggle variant status'
      });
    }
  };

  // Update variant (AJAX endpoint for modal)
  updateVariant = async (req, res) => {
    try {
      const { variantId, size, color, price, stock, sku, isActive } = req.body;

      if (!variantId || !size || !color || price === undefined || stock === undefined) {
        return res.status(400).json({
          success: false,
          message: 'All required fields must be filled'
        });
      }

      const variantData = {
        size: size.trim(),
        color: color.trim(),
        price: parseFloat(price),
        stock: parseInt(stock),
        isActive: isActive === true || isActive === 'true'
      };

      // Handle SKU if provided
      if (sku !== undefined) {
        variantData.sku = sku.trim();
      }

      await ProductService.updateVariantFields(variantId, variantData);

      // Handle new images (append only)
      const newImageUrls = [];
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach(file => {
          if (file.location || file.path || file.url) {
            newImageUrls.push(file.location || file.path || file.url);
          }
        });
      }

      const existingVariant = await ProductService.getVariantById(variantId);
      const existingCount = existingVariant?.images?.length || 0;
      const finalCount = existingCount + newImageUrls.length;

      if (finalCount < 3) {
        return res.status(400).json({
          success: false,
          message: 'Variant must have at least 3 images'
        });
      }

      if (newImageUrls.length > 0) {
        await ProductService.addVariantImages(variantId, newImageUrls);
      }

      const updatedVariant = await ProductService.getVariantById(variantId);

      res.json({
        success: true,
        message: 'Variant updated successfully',
        variant: updatedVariant
      });
    } catch (error) {
      logger.error('Error updating variant:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update variant'
      });
    }
  };
}

export default new ProductController();