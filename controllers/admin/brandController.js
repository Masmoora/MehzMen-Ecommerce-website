import BrandService from '../../service/admin/brandService.js';
import logger from '../../logger.js';

class BrandController {
  loadBrands = async (req, res) => {
    try {
      const search = req.query.search || '';
      const page = parseInt(req.query.page) || 1;
      const limit = 6;

      const { brands, totalPages } =
        await BrandService.getBrands(search, page, limit);

      res.render('brand', {
        brands,
        search,
        page,
        totalPages,
        limit
      });
    } catch (error) {
      logger.error('page not found', error);
      return res.redirect('/admin/pageerror');
    }
  };

  addBrand = async (req, res) => {
    try {
      console.log('FILE:', req.file);
      const { name, isListed } = req.body;
      const logo = req.file ? req.file.location : null;
      console.log('FILE:', req.file);
      if (!name || !logo) {
        return res.status(400).json({
          success: false,
          message: 'Brand name and logo are required'
        });
      }

      const exists = await BrandService.findbrandByName(name.trim());
      if (exists) {
        return res.status(409).json({
          success: false,
          message: 'Brand already exists'
        });
      }

      await BrandService.createBrand({
        name: name.trim(),
        logo,
        isListed
      });

      return res.status(201).json({
        success: true,
        message: 'Brand added successfully'
      });

    } catch (error) {
      console.error('Add brand error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };

  editBrand = async (req, res) => {
    try {
      const { id, name, isListed } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Brand name is required'
        });
      }

      const updateData = {
        name: name.trim(),
        isListed
      };

      // new logo uploaded
      if (req.file) {
        updateData.logo = req.file.location;
      }

      await BrandService.updateBrand(id, updateData);

      return res.status(200).json({
        success: true,
        message: 'Brand updated successfully'
      });

    } catch (error) {
      console.error('Edit brand error:', error);
      res.status(500).json({
        success: false,
        message: 'Update failed'
      });
    }
  };

  toggleBrandStatus = async (req, res) => {
    try {
      const { id } = req.params;

      const status = await BrandService.toggleBrandStatus(id);

      return res.status(200).json({
        success: true,
        status
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Toggle failed'
      });
    }
  };

}

export default new BrandController();
