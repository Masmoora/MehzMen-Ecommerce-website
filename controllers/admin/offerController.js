import offerService from '../../service/admin/offerService.js'
import logger from '../../logger.js';
const PAGE_SIZE = 10;

class OfferController {
  // GET /admin/productOffers
  async loadProductOffers(req, res) {
    try {
      const { page = 1, search = '' } = req.query;

      const safePage = Number(page) || 1;
      const limit = 10;

      const [products, offersResult] = await Promise.all([
        offerService.getProducts(),
        offerService.getProductOffers(search, safePage, limit)
      ]);

      return res.render('productOffer', {
        products,
        offers: offersResult.offers,
        search,
        page: offersResult.page,
        totalPages: offersResult.totalPages
      });
    } catch (error) {
      logger.error('Error loading product offers:', error);
      return res.status(500).render('admin/pageerror');
    }
  }

  // POST /admin/createProductOffer
  async createProductOffer(req, res) {
    try {
      const {
        productId,
        offerTitle,
        discountType,
        discountValue,
        startDate,
        endDate
      } = req.body || {};

      // Basic required validation
      if (!productId || !offerTitle || !discountType || discountValue == null || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      // Discount value
      const value = Number(discountValue);
      if (Number.isNaN(value) || value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount value must be a positive number'
        });
      }

      // Discount type and range
      if (discountType !== 'percentage' && discountType !== 'fixed') {
        return res.status(400).json({
          success: false,
          message: 'Invalid discount type'
        });
      }

      if (discountType === 'percentage' && (value < 1 || value > 90)) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount must be between 1 and 90'
        });
      }

      // Dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dates'
        });
      }

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
      }

      // Prevent duplicate active offer for same product
      const existingActiveOffer = await offerService.existingProductOffer(productId);
      if (existingActiveOffer) {
        return res.status(400).json({
          success: false,
          message: 'An active offer already exists for this product'
        });
      }

      // Prepare data for service
      const data = {
        offerType: 'product',
        productId,
        offerTitle: offerTitle.trim(),
        discountType,
        discountValue: value,
        startDate: start,
        endDate: end,
        status: 'active'
      };

      await offerService.createOffer(data);

      return res.json({
        success: true,
        message: 'Offer created successfully'
      });
    } catch (error) {
      logger.error('Error creating product offer:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create offer'
      });
    }
  }

  // POST /admin/updateProductOffer
  async updateProductOffer(req, res) {
    try {
      const {
        id,
        offerTitle,
        discountType,
        discountValue,
        startDate,
        endDate
      } = req.body || {};

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Offer id is required'
        });
      }

      if (!offerTitle || !discountType || discountValue == null || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      const value = Number(discountValue);
      if (Number.isNaN(value) || value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount value must be a positive number'
        });
      }

      if (discountType !== 'percentage' && discountType !== 'fixed') {
        return res.status(400).json({
          success: false,
          message: 'Invalid discount type'
        });
      }

      if (discountType === 'percentage' && (value < 1 || value > 90)) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount must be between 1 and 90'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dates'
        });
      }

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
      }

      const data = {
        offerTitle: offerTitle.trim(),
        discountType,
        discountValue: value,
        startDate: start,
        endDate: end
      };

      await offerService.updateOffer(id, data);

      return res.json({
        success: true,
        message: 'Offer updated successfully'
      });
    } catch (error) {
      logger.error('Error updating product offer:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update offer'
      });
    }
  }

  // GET /admin/deleteProductOffer/:id
  async deleteProductOffer(req, res) {
    try {
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Offer id is required'
        });
      }

      await offerService.deleteOffer(id);

      return res.json({
        success: true,
        message: 'Offer deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting product offer:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete offer'
      });
    }
  }

  // GET /admin/toggleProductOffer/:id
  async toggleProductOffer(req, res) {
    try {
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Offer id is required'
        });
      }

      const offer = await offerService.toggleOffer(id);

      return res.json({
        success: true,
        message: offer.status === 'active'
          ? 'Offer activated successfully'
          : 'Offer deactivated successfully'
      });
    } catch (error) {
      logger.error('Error toggling product offer:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to change offer status'
      });
    }
  }
  //CATEGORY OFFER CONTROLLER
  // GET /admin/categoryOffers
  async loadCategoryOffers(req, res) {
    try {
      const { page = 1, search = '' } = req.query || {};

      const [listResult, categories] = await Promise.all([
        offerService.getCategoryOffers({ search, page, limit: PAGE_SIZE }),
        offerService.getCategories()
      ]);

      return res.render('categoryOffer', {
        offers: listResult.offers,
        categories,
        search: String(search || ''),
        page: listResult.page,
        totalPages: listResult.totalPages
      });
    } catch (error) {
      logger.error('Error loading category offers:', error);
      return res.status(500).render('admin/pageerror');
    }
  }

  // POST /admin/createCategoryOffer
  async createCategoryOffer(req, res) {
    try {
      const {
        categoryId,
        offerTitle,
        discountType,
        discountValue,
        startDate,
        endDate
      } = req.body || {};

      if (!categoryId || !offerTitle || !discountType || discountValue == null || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }

      const numericValue = Number(discountValue);
      if (Number.isNaN(numericValue) || numericValue <= 0) {
        return res.status(400).json({ success: false, message: 'Discount value must be greater than 0' });
      }

      if (!['percentage', 'fixed'].includes(discountType)) {
        return res.status(400).json({ success: false, message: 'Invalid discount type' });
      }

      if (discountType === 'percentage' && (numericValue < 1 || numericValue > 90)) {
        return res
          .status(400)
          .json({ success: false, message: 'Percentage discount must be between 1 and 90' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
        return res
          .status(400)
          .json({ success: false, message: 'Start date must be before end date' });
      }

      const existing = await offerService.existingCategoryOffer(categoryId);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'An active offer already exists for this category '
        });
      }

      const data = {
        offerType: 'category',
        productId: null,
        categoryId,
        offerTitle: String(offerTitle).trim(),
        discountType,
        discountValue: numericValue,
        startDate: start,
        endDate: end,
        status: 'active'
      };

      await offerService.createOffer(data);

      return res.json({ success: true, message: 'Category offer created successfully' });
    } catch (error) {
      logger.error('Error creating category offer:', error);
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Failed to create category offer' });
    }
  }

  // POST /admin/updateCategoryOffer
  async updateCategoryOffer(req, res) {
    try {
      const { id } = req.body || {};
      const {
        offerTitle,
        discountType,
        discountValue,
        startDate,
        endDate
      } = req.body || {};

      if (!id) {
        return res.status(400).json({ success: false, message: 'Offer id is required' });
      }

      if (!offerTitle || discountValue == null || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }

      const numericValue = Number(discountValue);
      if (Number.isNaN(numericValue) || numericValue <= 0) {
        return res.status(400).json({ success: false, message: 'Discount value must be greater than 0' });
      }

      if (discountType && !['percentage', 'fixed'].includes(discountType)) {
        return res.status(400).json({ success: false, message: 'Invalid discount type' });
      }

      if (discountType === 'percentage' && (numericValue < 1 || numericValue > 90)) {
        return res
          .status(400)
          .json({ success: false, message: 'Percentage discount must be between 1 and 90' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
        return res
          .status(400)
          .json({ success: false, message: 'Start date must be before end date' });
      }

      const data = {
        offerTitle: String(offerTitle).trim(),
        discountValue: numericValue,
        startDate: start,
        endDate: end
      };
      if (discountType) data.discountType = discountType;

      await offerService.updateOffer(id, data);
      return res.json({ success: true, message: 'Category offer updated successfully' });
    } catch (error) {
      logger.error('Error updating category offer:', error);
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Failed to update category offer' });
    }
  }

  // GET /admin/deleteCategoryOffer/:id
  async deleteCategoryOffer(req, res) {
    try {
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, message: 'Offer id is required' });
      }

      await offerService.deleteOffer(id);
      return res.json({ success: true, message: 'Category offer deleted successfully' });
    } catch (error) {
      logger.error('Error deleting category offer:', error);
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Failed to delete offer' });
    }
  }

  // GET /admin/toggleCategoryOffer/:id
  async toggleCategoryOffer(req, res) {
    try {
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, message: 'Offer id is required' });
      }

      const offer = await offerService.toggleOffer(id);
      if (!offer) {
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      return res.json({
        success: true,
        message: offer.status === 'active' ? 'Offer activated' : 'Offer deactivated'
      });
    } catch (error) {
      logger.error('Error toggling category offer:', error);
      return res
        .status(400)
        .json({ success: false, message: error.message || 'Failed to toggle offer' });
    }
  }
}

export default new OfferController();