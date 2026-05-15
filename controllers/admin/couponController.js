import couponService from "../../service/admin/couponService.js";
import logger from '../../logger.js';
class CouponController {
  loadCoupons = async (req, res) => {
    try {
      const { page = 1, search = '' } = req.query || {};
      const result = await couponService.getCoupons({ page, limit: 10, search });

      return res.render('coupon', {
        coupons: result.coupons,
        search: String(search || ''),
        currentPage: result.pagination.page,
        totalPages: result.pagination.totalPages
      });
    } catch (error) {
      logger.error('Error loading coupons list:', error);
      return res.status(500).render('admin/pageerror');
    }
  };

  loadAddCoupon = async (_req, res) => {
    return res.render('addCoupon');
  };

  createCoupon = async (req, res) => {
    try {
      const {
        code,
        type,
        value,
        minOrderValue,
        startDate,
        endDate,
        usageLimit,
        isActive
      } = req.body || {};

      const data = {
        code: String(code || '').trim().toUpperCase(),
        type: type === 'fixed' ? 'fixed' : 'percentage',
        value: Number(value || 0),
        minOrderValue: Number(minOrderValue || 0),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        isActive: isActive === 'on' || isActive === true || isActive === 'true'
      };
 

      if (!data.code || !data.value) {
        if (req.is('application/json')) {
          return res.status(400).json({ success: false, message: 'Code and value are required' });
        }
        return res.status(400).render('addCoupon', {
          error: 'Code and value are required',
          old: req.body
        });
      }
      console.log("helloo",value)
      console.log(minOrderValue)
      if(data.value>data.minOrderValue){
        return res.status(400).json({ success: false, message: 'min order should be greater than value' });
      }

      if (startDate) data.startDate = new Date(startDate);
      if (endDate) data.endDate = new Date(endDate);

      await couponService.create(data);
      if (req.is('application/json')) {
        return res.json({ success: true, message: 'Coupon created successfully' });
      }
      return res.redirect('/admin/coupons');
    } catch (error) {
      logger.error('Error creating coupon:', error);
      if (req.is('application/json')) {
        return res.status(400).json({ success: false, message: error.message || 'Failed to create coupon' });
      }
      return res.status(400).render('addCoupon', {
        error: error.message || 'Failed to create coupon',
        old: req.body
      });
    }
  };

  loadEditCoupon = async (req, res) => {
    try {
      const { id } = req.params || {};
      const coupon = await couponService.getById(id);
      if (!coupon) return res.redirect('/admin/coupons');

      return res.render('editCoupon', { coupon });
    } catch (error) {
      logger.error('Error loading coupon edit page:', error);
      return res.status(500).render('admin/pageerror');
    }
  };

  updateCoupon = async (req, res) => {
    try {
      const { id } = req.params || {};
      const {
        code,
        type,
        value,
        minOrderValue,
        startDate,
        endDate,
        usageLimit,
        isActive
      } = req.body || {};

      const data = {
        code: String(code || '').trim().toUpperCase(),
        type: type === 'fixed' ? 'fixed' : 'percentage',
        value: Number(value || 0),
        minOrderValue: Number(minOrderValue || 0),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        isActive: isActive === 'on' || isActive === true || isActive === 'true'
      };

      if (!data.code || !data.value) {
        const msg = 'Code and value are required';
        if (req.is('application/json')) {
          return res.status(400).json({ success: false, message: msg });
        }
        return res.status(400).render('admin/couponEdit', {
          error: msg,
          coupon: { ...(req.body || {}), _id: id }
        });
      }

      const existing = await couponService.findByCodeExcludingId(data.code, id);
      if (existing) {
        const msg = 'Coupon code already exists';
        if (req.is('application/json')) {
          return res.status(400).json({ success: false, message: msg });
        }
        return res.status(400).render('editCoupon', {
          error: msg,
          coupon: { ...(req.body || {}), _id: id }
        });
      }

      if (startDate) data.startDate = new Date(startDate);
      else data.startDate = null;

      if (endDate) data.endDate = new Date(endDate);
      else data.endDate = null;

      await couponService.update(id, data);
      if (req.is('application/json')) {
        return res.json({ success: true, message: 'Coupon updated successfully' });
      }
      return res.redirect('/admin/coupons');
    } catch (error) {
      logger.error('Error updating coupon:', error);
      if (req.is('application/json')) {
        return res
          .status(400)
          .json({ success: false, message: error.message || 'Failed to update coupon' });
      }
      return res.status(400).render('editCoupon', {
        error: error.message || 'Failed to update coupon',
        coupon: { ...(req.body || {}), _id: req.params?.id }
      });
    }
  };

  deleteCoupon = async (req, res) => {
    try {
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, message: 'Coupon id is required' });
      }

      await couponService.delete(id);
      return res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
      logger.error('Error deleting coupon:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to delete coupon' });
    }
  };


}
export default new CouponController();
