import dashboardService from "../../service/admin/dashboardService.js";
class DashboardController{
        loadDashboard = async (req, res) => {
            try {
                return res.render('dashboard');
            } catch (error) {
                logger.error('page not found', error);
                return res.redirect('/admin/pageerror');
            }
        };

          getDashboardData = async (req, res) => {
    try {
      const {
        filter = 'monthly',
        start = '',
        end = ''
      } = req.query || {};

      const data = await dashboardService.getDashboardData({ filter, start, end });
      return res.json(data);
    } catch (error) {
      console.error('Error while loading dashboard data', error);
      return res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
    }
  };

}
export default new DashboardController();