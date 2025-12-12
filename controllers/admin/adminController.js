import AdminService from '../../service/adminService.js'

class AdminController {

    pageerror = async (req, res) => {
        res.render('pageerror');
    };

    //get admin login page
    loadLogin = async (req, res) => {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard');
        }
        res.render('admin-login', { message: "" });
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
                return res.render('/admin/login', { message: 'Invalid password' });
            }
        } catch (error) {
            console.log('login error', error);
            return res.redirect('/pageerror');

        }
    };

    loadDashboard = async (req, res) => {
        if (req.session.admin) {
            try {
                return res.render('dashboard');
            } catch (error) {
                return res.render('pageerror');
            }
        } else {
            return res.render('admin-login')
        }
    };

    logout = async (req, res) => {
        try {
            if (req.session.admin) {

                delete req.session.admin;

                req.session.save((err) => {
                    if (err) {
                        console.log('Error saving session during logout:', err);
                        return res.redirect('/admin/pageerror');
                    }
                    return res.redirect('/admin/login');
                });
            } else {

                return res.redirect('/admin/login');
            }
        } catch (error) {
            console.log('Logout error:', error);
            return res.redirect('/admin/pageerror');
        }
    }
}

export default new AdminController();