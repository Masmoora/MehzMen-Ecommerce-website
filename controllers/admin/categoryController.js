import CategoryService from '../../service/admin/categoryService.js';
import logger from '../../logger.js';


class CategoryController {
    //get category page
    loadCategories = async (req, res) => {
        try {
            let search = '';
            if (req.query.search) {
                search = req.query.search;
            }

            let page = 1;
            if (req.query.page) {
                page = parseInt(req.query.page, 10);
            }
            let limit = 2;
            let { categories, totalPages } = await CategoryService.listCategory(
                search,
                page,
                limit,
            );
            res.render('category', {
                categories,
                search, page,
                totalPages,
                success: req.query.success,
                error: req.query.error
            });
        } catch (error) {
            logger.error('page not found', error);
            return res.redirect('/pageerror');

        }
    };

    // Add new category
    addCategory = async (req, res) => {
        try {
            const { name, description } = req.body;
            // Save relative path from public folder for serving static files
            const image = req.file ? req.file.location : null;
            const isListed = req.body.isListed !== 'false';

            // Validate required fields
            if (!name || !name.trim()) {
                return res.redirect('/admin/category?error=name_required');
            }
            const trimmedName = name.trim();
      const existingCategory = await CategoryService.getCategoryByNameInsensitive(trimmedName);
      if (existingCategory) {
        return res.redirect('/admin/category?error=exists');
      }


            if (!image) {
                return res.redirect('/admin/category?error=image_required');
            }

            const result = await CategoryService.addCategory({
                name,
                description,
                image,
                isListed: req.body.isListed !== 'false'
            });
            console.log('Saved image path', image);

            if (!result.success && result.reason === 'exists') {
                return res.redirect('/admin/category?error=exists');
            }

            res.redirect('/admin/category?success=added');
        } catch (error) {
            logger.error('Error adding category:', error);
            res.redirect('/admin/category?error=failed');
        }
    };

    // Edit category

    editCategory = async (req, res) => {
        try {
            const { id, name, description, isListed } = req.body;
                  if (!id) {
        return res.redirect('/admin/category?error=edit_failed');
      }

      if (!name || !name.trim()) {
        return res.redirect('/admin/category?error=edit_failed');
      }

      const trimmedName = name.trim();
      const existingCategory = await CategoryService.getCategoryByNameInsensitive(
        trimmedName,
        id
      );
      if (existingCategory) {
        return res.redirect('/admin/category?error=exists');
      }

            const updateData = {
                name: name.trim(),
                description,
                isListed: isListed === 'true'
            };

            if (req.file) {
                updateData.image = `/uploads/categories/${req.file.filename}`;
            }

            await CategoryService.updateCategory(id, updateData);

            res.redirect('/admin/category?success=updated');
        } catch (error) {
            logger.error('Edit category error', error);
            res.redirect('/admin/category?error=edit_failed');
        }
    };

    // LIST category
    listCategory = async (req, res) => {
        try {
            const { id } = req.query;

            if (!id) {
                return res.redirect('/admin/category?error=list_failed');
            }

            await CategoryService.listCategoryStatus(id);

            res.redirect('/admin/category?success=listed');

        } catch (error) {
            logger.error('List category error:', error);
            res.redirect('/admin/category?error=list_failed');
        }
    };

    // UNLIST category
    unlistCategory = async (req, res) => {
        try {
            const { id } = req.query;

            if (!id) {
                return res.redirect('/admin/category?error=unlist_failed');
            }

            await CategoryService.unlistCategoryStatus(id);

            res.redirect('/admin/category?success=unlisted');

        } catch (error) {
            logger.error('Unlist category error:', error);
            res.redirect('/admin/category?error=unlist_failed');
        }
    };
addOffer = async (req, res) => {
  try {

    const {
      categoryId,
      offerTitle,
      discountType,
      discountValue,
      startDate,
      endDate
    } = req.body;

    // VALIDATION

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required"
      });
    }

    if (!offerTitle || !offerTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: "Offer title is required"
      });
    }

    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount type"
      });
    }

    if (!discountValue || discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0"
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date required"
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }

    await CategoryService.addCategoryOffer({
      categoryId,
      offerTitle,
      discountType,
      discountValue,
      startDate,
      endDate
    });

    res.json({
      success: true,
      message: "Offer added successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
  // GET OFFER (for edit modal)
  getOffer = async (req, res) => {

    try {

      const { categoryId } = req.params;

      const offer = await CategoryService.getCategoryOffer(categoryId);

      return res.json({
        success: true,
        offer
      });

    } catch (error) {

      logger.error("Get category offer error:", error);

      return res.status(500).json({
        success: false
      });

    }
  };

  // EDIT OFFER
  editOffer = async (req, res) => {

    try {

      const {
        categoryId,
        offerTitle,
        discountType,
        discountValue,
        startDate,
        endDate
      } = req.body;

      await CategoryService.editCategoryOffer(categoryId, {
        offerTitle,
        discountType,
        discountValue,
        startDate,
        endDate
      });

      return res.json({
        success: true,
        message: "Offer updated successfully"
      });

    } catch (error) {

      logger.error("Edit category offer error:", error);

      return res.status(500).json({
        success: false
      });

    }
  };

  // REMOVE OFFER
  removeOffer = async (req, res) => {

    try {

      const { categoryId } = req.params;

      await CategoryService.removeCategoryOffer(categoryId);

      return res.json({
        success: true,
        message: "Offer removed successfully"
      });

    } catch (error) {

      logger.error("Remove category offer error:", error);

      return res.status(500).json({
        success: false
      });

    }
  }
}
export default new CategoryController();
