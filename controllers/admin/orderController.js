import AdminOrderService from '../../service/admin/orderService.js';


class AdminOrderController {
  loadOrders = async (req, res) => {
    try {
      const { page = 1, limit = 10, search = '', status = '', sort = 'date_desc' } = req.query || {};
      const data = await AdminOrderService.listOrders({ page, limit, search, status, sort });
      return res.render('Adminorders', data);
    } catch (error) {
      return res.status(500).render('admin/pageerror');
    }
  };

  loadOrderDetails = async (req, res) => {
    try {
      const { orderId } = req.params || {};
      const order = await AdminOrderService.getOrderDetails(orderId);
      return res.render('AdminorderDetails', { order });
    } catch (error) {
      return res.status(404).render('admin/pageerror');
    }
  };

  updateOrderStatus = async (req, res) => {
    try {
      const { orderId } = req.params || {};
      const { status } = req.body || {};
      const order = await AdminOrderService.updateOrderStatus(orderId, status);
      return res.json({ success: true, message: 'Order status updated', orderStatus: order.orderStatus });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Failed to update order status' });
    }
  };

  cancelOrder = async (req, res) => {
    try {
      const { orderId } = req.params || {};
      const { cancelReason = '' } = req.body || {};
      const order = await AdminOrderService.cancelOrder(orderId, cancelReason);
      return res.json({ success: true, message: 'Order cancelled', orderStatus: order.orderStatus });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Failed to cancel order' });
    }
  };

  updateItemStatus = async (req, res) => {
    try {
      const { orderId, itemId } = req.params || {};
      const { status } = req.body || {};
      const order = await AdminOrderService.updateItemStatus(orderId, itemId, status);
      return res.json({ success: true, message: 'Item status updated', orderStatus: order.orderStatus });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Failed to update item status' });
    }
  };

  cancelItem = async (req, res) => {
    try {
      const { orderId, itemId } = req.params || {};
      const { cancelReason = '' } = req.body || {};
      const order = await AdminOrderService.cancelItem(orderId, itemId, cancelReason);
      return res.json({ success: true, message: 'Item cancelled', orderStatus: order.orderStatus });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Failed to cancel item' });
    }
  };

  approveReturn = async (req, res) => {
    try {
      const { orderId, itemId } = req.params || {};
      const order = await AdminOrderService.approveReturn(orderId, itemId);
      return res.json({ success: true, message: 'Return approved', orderStatus: order.orderStatus });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Failed to approve return' });
    }
  };

  rejectReturn = async (req, res) => {
    try {
      const { orderId, itemId } = req.params || {};
      const { rejectionReason = '' } = req.body || {};
      const order = await AdminOrderService.rejectReturn(orderId, itemId, rejectionReason);
      return res.json({ success: true, message: 'Return rejected', orderStatus: order.orderStatus });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Failed to reject return' });
    }
  };

  markReturned = async (req, res) => {
    try {
      const { orderId, itemId } = req.params || {};
      const order = await AdminOrderService.markReturned(orderId, itemId);
      return res.json({ success: true, message: 'Item marked returned', orderStatus: order.orderStatus });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Failed to mark returned' });
    }
  };

 async downloadInvoice(req, res, next) {
    try {
      const { orderId } = req.params;

      const { fileName, filePath } =
        await AdminOrderService.generateInvoiceForAdmin(orderId);

      return res.download(filePath, fileName);

    } catch (error) {
      next(error);
    }
  }
}

export default new AdminOrderController();
