import User from '../models/userSchema.js';

class AuthMiddleware {

    checkSession = async (req, res, next) => {
        try {

            if (!req.session.user) {
                return res.redirect('/login');
            }

            const userData = await User.findById(req.session.user);

            if (!userData) {
                return req.session.destroy(() => {
                    res.redirect('/signup');
                });
            }

            if (userData.isBlocked) {
                return req.session.destroy(() => {
                    res.redirect('/login?blocked=true');
                });
            }

            next();

        } catch (error) {
            console.log('Error in checkSession middleware:', error);
            res.status(500).send('Server error');
        }
    };


    isLogin = async (req, res, next) => {
        try {

            if (req.session.user) {

                const userData = await User.findById(req.session.user);

                if (userData && userData.isBlocked) {
                    return req.session.destroy(() => {
                        res.redirect('/login?blocked=true');
                    });
                }

                return res.redirect('/');
            }

            next();

        } catch (error) {
            console.log('Error in isLogin middleware:', error);
            res.status(500).send('Server error');
        }
    };


    adminAuth = async (req, res, next) => {
        try {

            if (!req.session.admin) {
                return res.redirect('/admin/login');
            }

            const admin = await User.findById(req.session.admin);

            if (admin && admin.isAdmin) {
                next();
            } else {
                return res.redirect('/admin/login');
            }

        } catch (error) {
            console.log('Access denied: not admin');
            res.status(500).send('Server Error');
        }
    };


    isAdminLogin = async (req, res, next) => {
        try {

            if (req.session.admin) {
                return res.redirect('/admin/dashboard');
            }

            next();

        } catch (error) {
            console.log('Error in isAdminLogin middleware:', error);
            res.status(500).send('Server error');
        }
    };

}

export default new AuthMiddleware();