import AdminService from '../../service/admin/adminService.js';
import logger from '../../logger.js';
import HTTP_STATUS from '../../constants/httpStatus.js';

import { generatePdfReport, generateExcelReport } from '../../utils/salesReportHelper.js';
function formatRangeLabel(rangeType, startDate, endDate) {
  if (rangeType === 'week') return 'This Week';
  if (rangeType === 'month') return 'This Month';
  if (rangeType === 'custom') {
    if (startDate && endDate) return `${startDate} to ${endDate}`;
    return 'Custom Range';
  }
  return 'Today';
}
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
   
    //salesReport




async handleReport(req, res) {
  try {
    const {
      rangeType = 'day',
      startDate = '',
      endDate = '',
      page = 1,
      format = ''
    } = req.query || {};

    const report = await AdminService.getSalesReport({
      rangeType,
      startDate,
      endDate,
      page
    });

    // Download as PDF / Excel if requested
    const reportMeta = {
        websiteName: 'Mehzmen',
        rangeLabel: formatRangeLabel(rangeType, startDate, endDate),
        generatedAt: new Date()
      };

      if (format === 'pdf') {
        return generatePdfReport(res, report.fullSalesData, report.totals, reportMeta);
      }

      if (format === 'excel') {
        return generateExcelReport(res, report.fullSalesData, report.totals, reportMeta);
      }


    // Render HTML page
    return res.render('salesReport', {
      salesData: report.salesDataPage,
      totalSale: report.totals.totalSale,
      totalAmount: report.totals.totalAmount,
      totalDiscount: report.totals.totalDiscount,
      totalOffer: report.totals.totalOffer,
      currentPage: report.pagination.currentPage,
      totalPages: report.pagination.totalPages,
      rangeType,
      startDate,
      endDate
    });
  } catch (error) {
    logger?.error?.('Error while loading sales report page', error);
    console.error('Error while loading sales report page', error);
    return res.redirect('/admin/pageerror');
  }
}

}

export default new AdminController();