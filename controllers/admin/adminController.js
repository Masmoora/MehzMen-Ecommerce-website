import AdminService from '../../service/admin/adminService.js';
import logger from '../../logger.js';
import HTTP_STATUS from '../../constants/httpStatus.js';

class AdminController {

    pageerror = async (req, res) => {
        try {
            res.render('pageerror');
        } catch (error) {
            logger.error('Error rendering 404 page: ', error);
            res
                .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
                .send(`Error loading ${HTTP_STATUS.BAD_REQUEST} page`);
        }
    };

    //get admin login page

    loadLogin = async (req, res) => {
        try {
            return res.render('admin-login');
        } catch (error) {
            logger.error('page not found', error);
            return res.redirect('/pageerror');
        }
    };

    //post login page
    login = async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email) {
                return res.render('admin-login', { message: 'Email is required' });
            }
            if (!password) {
                return res.render('admin-login', { message: 'Enter Password' });
            }
            const admin = await AdminService.findAdminByEmail(email);
            if (!admin) {
                return res.render('admin-login', { message: 'Invalid admin credentials' });
            }
            const isMatch = await AdminService.comparePassword(password, admin.password);
            if (isMatch) {
                req.session.admin = admin._id;
                return res.redirect('/admin/dashboard');
            } else {
                return res.render('/admin-login', { message: 'Invalid password' });
            }
        } catch (error) {
            logger.error('page not found', error);
            return res.redirect('/pageerror');

        }
    };

    loadDashboard = async (req, res) => {
        try {
            return res.render('dashboard');
        } catch (error) {
            logger.error('page not found', error);
            return res.redirect('/admin/pageerror');
        }
    };

    logout = async (req, res) => {
        try {
            req.session.destroy((err) => {
                if (err) {
                    logger.error('error in destroying session');
                    return res.redirect('/admin/dashboard');
                }
            });
            return res.redirect('/admin/login');
        } catch (error) {
            logger.error('page not found', error);
            return res.redirect('/admin/pageNotFound');
        }
    };
}

export default new AdminController();