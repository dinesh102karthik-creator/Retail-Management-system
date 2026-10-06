const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Grocery',
      'Beverages',
      'Snacks',
      'Personal Care',
      'Household',
      'Stationery',
      'Dairy',
      'Bakery'
    ]
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minStockAlert: {
    type: Number,
    required: true,
    default: 10,
    min: 1
  },
  supplier: {
    type: String,
    default: 'General Wholesale'
  },
  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock', 'Archived'],
    default: 'In Stock'
  },
  barcode: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: 'Main Floor'
  }
}, {
  timestamps: true
});

// Auto compute status before saving
productSchema.pre('save', function (next) {
  if (this.status !== 'Archived') {
    if (this.quantity === 0) {
      this.status = 'Out of Stock';
    } else if (this.quantity <= this.minStockAlert) {
      this.status = 'Low Stock';
    } else {
      this.status = 'In Stock';
    }
  }
});

module.exports = mongoose.model('Product', productSchema);
