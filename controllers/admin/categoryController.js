import CategoryService from '../../service/admin/categoryService.js'
import Category from '../../models/categorySchema.js';
import logger from '../../logger.js'
import HTTP_STATUS from '../../constants/httpStatus.js'

class CategoryController {
    //get category page
    loadCategories = async (req, res) => {
        try {
            let search = ""
            if (req.query.search) {
                search = req.query.search
            }

            let page = 1
            if (req.query.page) {
                page = parseInt(req.query.page, 10)
            }
            let limit = 2
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
            })
        } catch (error) {
            logger.error('page not found', error);
            return res.redirect('/pageerror');

        }
    }

    // Add new category
    addCategory = async (req, res) => {
        try {
            const { name, description } = req.body;
            // Save relative path from public folder for serving static files
            const image = req.file ? req.file.location:null;
            const isListed = req.body.isListed !== 'false'; // Default to true

            // Validate required fields
            if (!name || !name.trim()) {
                return res.redirect('/admin/category?error=name_required');
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
            console.log("Saved image path",image)

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



}
export default new CategoryController()
