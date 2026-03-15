import offerService from '../../service/admin/offerService.js';
import logger from '../../logger.js';

class OfferController {
  loadOffers = async (req, res) => {
    try {
      const { page = 1, search = '' } = req.query || {};
      const result = await offerService.getOffers({ page, limit: 10, search });
      const [products, categories] = await Promise.all([
        offerService.getProductsForDropdown(),
        offerService.getCategoriesForDropdown()
      ]);

      return res.render('offers', {
        offers: result.offers,
        search: String(search || ''),
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
        products,
        categories
      });
    } catch (error) {
      logger.error('Error loading offers list:', error);
      return res.status(500).render('admin/pageerror');
    }
  };

  addOffer = async (req, res) => {
    try {
      const {
        name,
        type,
        discountType,
        discountValue,
        startDate,
        endDate,
        productId,
        categoryId
      } = req.body || {};

      if (!name || !type || !discountType || discountValue == null || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Name, type, discountType, discountValue, startDate and endDate are required'
        });
      }

      const data = {
        name: String(name).trim(),
        type: type === 'CATEGORY' ? 'CATEGORY' : 'PRODUCT',
        discountType: discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE',
        discountValue: Number(discountValue),
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };

      if (data.type === 'PRODUCT') {
        if (!productId) {
          return res.status(400).json({ success: false, message: 'Product is required for product offer' });
        }
        data.productId = productId;
        data.categoryId = null;
      } else {
        if (!categoryId) {
          return res.status(400).json({ success: false, message: 'Category is required for category offer' });
        }
        data.categoryId = categoryId;
        data.productId = null;
      }

      await offerService.addOffer(data);
      return res.status(201).json({ success: true, message: 'Offer created successfully' });
    } catch (error) {
      logger.error('Error adding offer:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create offer'
      });
    }
  };

  updateOffer = async (req, res) => {
    try {
      const { id } = req.params || {};
      const { name, discountValue, startDate, endDate } = req.body || {};

      if (!name || discountValue == null || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Name, discountValue, startDate and endDate are required'
        });
      }

      const data = {
        name: String(name).trim(),
        discountValue: Number(discountValue),
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };

      await offerService.updateOffer(id, data);
      return res.json({ success: true, message: 'Offer updated successfully' });
    } catch (error) {
      logger.error('Error updating offer:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update offer'
      });
    }
  };

  deactivateOffer = async (req, res) => {
    try {
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, message: 'Offer id is required' });
      }
      await offerService.deactivateOffer(id);
      return res.json({ success: true, message: 'Offer deactivated successfully' });
    } catch (error) {
      logger.error('Error deactivating offer:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to deactivate offer'
      });
    }
  }
}

export default new OfferController();