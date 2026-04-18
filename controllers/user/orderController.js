import UserService from '../../service/user/userService.js';
import OrderService from '../../service/user/orderService.js';
import logger from '../../logger.js';

class OrderController {
  isValidOrderId = (orderId) => typeof orderId === 'string' && orderId.trim().length >= 10;
  loadOrders = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const { page = 1, search = '' } = req.query || {};
      const result = await OrderService.getOrdersForUser(userId, { page, search });

      return res.render('orders', {
        user,
        orders: result.orders,
        pagination: result.pagination,
        search: result.search
      });
    } catch (error) {
      logger.error('Error loading orders list:', error);
      return res.status(500).render('page-404');
    }
  };

  loadOrderDetails = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const { orderId } = req.params || {};
      if (!this.isValidOrderId(orderId)) return res.status(400).render('page-404');

      const order = await OrderService.getOrderForUser(userId, orderId);
      return res.render('orderDetails', { user, order });
    } catch (error) {
      logger.error('Error loading order details:', error);
      return res.status(404).render('page-404');
    }
  };

  cancelSingleItem = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { orderId, itemId } = req.params || {};
      const { cancelReason = '' } = req.body || {};
      if (!this.isValidOrderId(orderId) || !itemId) {
        return res.status(400).json({ success: false, message: 'Order id and item id are required' });
      }

      const result = await OrderService.cancelSingleItem(userId, orderId, itemId, cancelReason);
      return res.json({ success: true, message: 'Item cancelled successfully', data: result });
    } catch (error) {
      logger.error('Error cancelling single order item:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to cancel item' });
    }
  };

  cancelEntireOrder = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { orderId } = req.params || {};
      const { cancelReason = '' } = req.body || {};
      if (!this.isValidOrderId(orderId)) {
        return res.status(400).json({ success: false, message: 'Order id is required' });
      }

      const result = await OrderService.cancelEntireOrder(userId, orderId, cancelReason);
      return res.json({ success: true, message: 'Order cancelled successfully', data: result });
    } catch (error) {
      logger.error('Error cancelling full order:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to cancel order' });
    }
  };

  requestReturnOrder = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

      const { orderId } = req.params || {};
      const { returnReason = '' } = req.body || {};
      if (!this.isValidOrderId(orderId)) {
        return res.status(400).json({ success: false, message: 'Order id is required' });
      }

      const result = await OrderService.requestReturnOrder(userId, orderId, returnReason);
      return res.json({ success: true, message: 'Return request submitted successfully', data: result });
    } catch (error) {
      logger.error('Error requesting order return:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to request return' });
    }
  };
  downloadInvoice = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const { orderId } = req.params || {};
      if (!this.isValidOrderId(orderId)) {
        return res.status(400).send('Invalid order id');
      }

      const { fileName, filePath } = await OrderService.generateInvoiceForOrder(userId, orderId);

      return res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error sending invoice file:', err);
          if (!res.headersSent) return res.status(500).send('Error sending invoice');
        }
      });
    } catch (error) {
      console.error('Error downloading invoice:', error);
      return res.status(error.statusCode || 500).send(error.message || 'Error generating invoice');
    }
  };
  loadOrderSuccess = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');


      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const orderId = (req.query?.orderId || '').trim();
      return res.render('orderSuccess', { user, orderId: this.isValidOrderId(orderId) ? orderId : null });
    } catch (error) {
      logger.error('Error loading order success page:', error);
      return res.status(500).render('page-404');
    }
  };

  loadOrderFailure = async (req, res) => {
    try {
      const userId = req.session?.user;
      if (!userId) return res.redirect('/login');

      const user = await UserService.getUserById(userId);
      if (!user) return res.redirect('/pageNotFound');

      const orderId = (req.query?.orderId || '').trim();
      return res.render('orderFailure', { user, orderId: this.isValidOrderId(orderId) ? orderId : null });
    } catch (error) {
      logger.error('Error loading order failure page:', error);
      return res.status(500).render('page-404');
    }
  };
  requestItemReturn = async (req, res) => {
    try {

      const userId = req.session?.user;
      if (!userId)
        return res.status(401).json({ success: false, message: "Login required" });

      const { orderId, itemId } = req.params;
      const { returnReason = "", returnDescription = "" } = req.body;

      const result = await OrderService.requestItemReturn(
        userId,
        orderId,
        itemId,
        returnReason,
        returnDescription
      );

      return res.json({
        success: true,
        message: "Return request submitted",
        data: result
      });

    } catch (error) {

      logger.error("Error requesting item return:", error);

      return res.status(400).json({
        success: false,
        message: error.message || "Failed to request return"
      });

    }
  };
  cancelItemReturnRequest = async (req, res) => {

    try {

      const userId = req.session?.user;

      if (!userId)
        return res.status(401).json({ success: false, message: "Login required" });

      const { orderId, itemId } = req.params;

      const result = await OrderService.cancelItemReturnRequest(
        userId,
        orderId,
        itemId
      );

      return res.json({
        success: true,
        message: "Return request cancelled",
        data: result
      });

    } catch (error) {

      logger.error("Error cancelling return request:", error);

      return res.status(400).json({
        success: false,
        message: error.message || "Failed to cancel return request"
      });

    }
  };
  cancelEntireReturnRequest = async (req, res) => {

    try {

      const userId = req.session?.user;

      if (!userId)
        return res.status(401).json({ success: false, message: "Login required" });

      const { orderId } = req.params;

      const result = await OrderService.cancelEntireReturnRequest(
        userId,
        orderId
      );

      return res.json({
        success: true,
        message: "Entire return request cancelled",
        data: result
      });

    } catch (error) {

      logger.error("Error cancelling entire return:", error);

      return res.status(400).json({
        success: false,
        message: error.message || "Failed to cancel return request"
      });

    }

  };
}
export default new OrderController();