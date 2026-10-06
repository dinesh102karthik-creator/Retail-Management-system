const mongoose = require('mongoose');

const inventoryHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  productSku: {
    type: String,
    default: ''
  },
  productName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'STOCK_IN',
      'STOCK_OUT',
      'PRODUCT_CREATED',
      'PRODUCT_UPDATED',
      'PRODUCT_DELETED',
      'AUDIT_ADJUSTMENT'
    ]
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  quantityChanged: {
    type: Number,
    required: true
  },
  user: {
    type: String,
    default: 'Admin'
  },
  ip: {
    type: String,
    default: '127.0.0.1'
  },
  notes: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventoryHistory', inventoryHistorySchema);
