import CustomerService from '../../service/admin/customerService.js';
import logger from '../../logger.js';
import HTTP_STATUS from '../../constants/httpStatus.js';

class CustomerController {
    loadCustomers = async (req, res) => {
        try {
            let search = req.query.search || '';
            let page = 1;
            if (req.query.page) {
                page = req.query.page;
            }
            const limit = 1;

            const { users, totalPages } = await CustomerService.getUsers(
                search,
                page,
                limit,
            );
            res.render('customer', { users, search, page, totalPages });

        } catch (error) {
            logger.error('page not found', error);
            return res.redirect('/pageerror');

        }
    };

    blockCustomer = async (req, res) => {
        try {
            let id = req.query.id;
            await CustomerService.blockCustomer(id);
            const page = req.query.page || 1;
            const search = req.query.search || '';

            res.redirect(`/admin/customers?page=${page}&search=${search}`);
        } catch (error) {
            logger.error('page not found', error);
            res.redirect('/admin/pageerror');
        }
    };

    unblockCustomer = async (req, res) => {
        try {
            let id = req.query.id;
            await CustomerService.unblockCustomer(id);
            const page = req.query.page || 1;
            const search = req.query.search || '';

            res.redirect(`/admin/customers?page=${page}&search=${search}`);
        } catch (error) {
            logger.error('page not found', error);
            res.redirect('admin/pageerror');
        }
    };

}

export default new CustomerController();