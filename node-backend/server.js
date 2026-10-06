const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const Product = require('./models/Product');
const Supplier = require('./models/Supplier');
const InventoryHistory = require('./models/InventoryHistory');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/retail_inventory';
const isProduction = process.env.NODE_ENV === 'production';
const adminUsername = process.env.ADMIN_USERNAME || (isProduction ? '' : 'admin');
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'admin');

const path = require('path');

// Middleware
if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(session({
  name: 'retail.sid',
  secret: process.env.SESSION_SECRET || 'local-development-only-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',
    ttl: 8 * 60 * 60
  }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, '..', 'newJS')));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Helper for client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

function constantTimeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(left).digest();
  const rightHash = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function requireAuthentication(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'Authentication required' });
}

app.post('/api/auth/login', loginLimiter, (req, res, next) => {
  const { username, password } = req.body || {};
  const validUsername = typeof username === 'string'
    && constantTimeEqual(username, adminUsername);
  const validPassword = typeof password === 'string'
    && constantTimeEqual(password, adminPassword);

  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.regenerate(error => {
    if (error) return next(error);
    req.session.authenticated = true;
    req.session.username = adminUsername;
    req.session.save(saveError => {
      if (saveError) return next(saveError);
      res.json({ authenticated: true });
    });
  });
});

app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && req.path === '/health') return next();

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    const expectedOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    if (!origin || origin !== expectedOrigin) {
      return res.status(403).json({ error: 'Cross-origin request rejected' });
    }
  }

  requireAuthentication(req, res, next);
});

// ---------------- API ROUTES ---------------- //

app.get('/api/auth/session', (req, res) => {
  res.json({ authenticated: true, username: req.session.username });
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('retail.sid', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict'
    });
    res.status(204).end();
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    destructiveSeedEnabled: process.env.ALLOW_DESTRUCTIVE_SEED === 'true'
  });
});

// Dashboard Statistics & Analytics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const products = await Product.find({ status: { $ne: 'Archived' } });

    let totalProducts = products.length;
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;
    let totalCostValue = 0;

    const categoryBreakdown = {};

    products.forEach(p => {
      totalStock += p.quantity;
      totalInventoryValue += (p.quantity * p.price);
      totalCostValue += (p.quantity * p.costPrice);

      if (p.quantity === 0) {
        outOfStockCount++;
      } else if (p.quantity <= p.minStockAlert) {
        lowStockCount++;
      }

      if (!categoryBreakdown[p.category]) {
        categoryBreakdown[p.category] = { count: 0, stock: 0, value: 0 };
      }
      categoryBreakdown[p.category].count++;
      categoryBreakdown[p.category].stock += p.quantity;
      categoryBreakdown[p.category].value += (p.quantity * p.price);
    });

    const inStockCount = totalProducts - lowStockCount - outOfStockCount;

    const recentHistory = await InventoryHistory.find()
      .sort({ timestamp: -1 })
      .limit(8);

    const lowStockAlerts = await Product.find({
      status: { $in: ['Low Stock', 'Out of Stock'] }
    }).sort({ quantity: 1 }).limit(10);

    res.json({
      summary: {
        totalProducts,
        totalStock,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
        totalCostValue: Number(totalCostValue.toFixed(2)),
        estimatedProfitMargin: totalInventoryValue > 0
          ? Number((((totalInventoryValue - totalCostValue) / totalInventoryValue) * 100).toFixed(1))
          : 0
      },
      categoryBreakdown,
      recentHistory,
      lowStockAlerts
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});

// Products CRUD
// GET /api/products (filter by search, category, status)
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, status, sortBy = 'name', sortOrder = 'asc' } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } }
      ];
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const products = await Product.find(filter).sort(sortOptions);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Invalid product ID' });
  }
});

// POST Create Product
app.post('/api/products', async (req, res) => {
  try {
    const { sku, name, category, price, costPrice, quantity, minStockAlert, supplier, barcode, location, notes } = req.body;

    if (!sku || !name || !category || price === undefined) {
      return res.status(400).json({ error: 'SKU, name, category, and price are required.' });
    }

    const existing = await Product.findOne({ sku: sku.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ error: `Product with SKU "${sku}" already exists.` });
    }

    const initialQty = Number(quantity) || 0;
    const alertQty = Number(minStockAlert) || 10;
    let status = 'In Stock';
    if (initialQty === 0) status = 'Out of Stock';
    else if (initialQty <= alertQty) status = 'Low Stock';

    const product = new Product({
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category,
      price: Number(price),
      costPrice: Number(costPrice) || 0,
      quantity: initialQty,
      minStockAlert: alertQty,
      supplier: supplier || 'General Wholesale',
      status,
      barcode: barcode || '',
      location: location || 'Main Floor'
    });

    const saved = await product.save();

    // Record Audit Trail
    await InventoryHistory.create({
      productId: saved._id,
      productSku: saved.sku,
      productName: saved.name,
      action: 'PRODUCT_CREATED',
      previousQuantity: 0,
      newQuantity: saved.quantity,
      quantityChanged: saved.quantity,
      user: req.body.user || 'Admin',
      ip: getClientIp(req),
      notes: notes || `Created new item: ${saved.name}`
    });

    res.status(201).json(saved);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message || 'Failed to create product' });
  }
});

// PUT Update Product
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const prevQty = product.quantity;
    const fields = ['name', 'category', 'price', 'costPrice', 'minStockAlert', 'supplier', 'barcode', 'location'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });

    // Check if quantity is directly modified
    let quantityChanged = 0;
    if (req.body.quantity !== undefined && Number(req.body.quantity) !== prevQty) {
      const newQty = Math.max(0, Number(req.body.quantity));
      quantityChanged = newQty - prevQty;
      product.quantity = newQty;
    }

    // Update status
    if (product.quantity === 0) {
      product.status = 'Out of Stock';
    } else if (product.quantity <= product.minStockAlert) {
      product.status = 'Low Stock';
    } else {
      product.status = 'In Stock';
    }

    const updated = await product.save();

    // Log history
    await InventoryHistory.create({
      productId: updated._id,
      productSku: updated.sku,
      productName: updated.name,
      action: quantityChanged !== 0 ? 'AUDIT_ADJUSTMENT' : 'PRODUCT_UPDATED',
      previousQuantity: prevQty,
      newQuantity: updated.quantity,
      quantityChanged: quantityChanged,
      user: req.body.user || 'Admin',
      ip: getClientIp(req),
      notes: req.body.notes || (quantityChanged !== 0 ? `Manual quantity correction from ${prevQty} to ${updated.quantity}` : 'Product details updated')
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
});

// DELETE Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await Product.findByIdAndDelete(req.params.id);

    // Audit log
    await InventoryHistory.create({
      productId: product._id,
      productSku: product.sku,
      productName: product.name,
      action: 'PRODUCT_DELETED',
      previousQuantity: product.quantity,
      newQuantity: 0,
      quantityChanged: -product.quantity,
      user: req.body.user || 'Admin',
      ip: getClientIp(req),
      notes: req.body.notes || `Product ${product.name} (${product.sku}) removed from catalog`
    });

    res.json({ message: 'Product deleted successfully', id: req.params.id });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Stock In / Stock Out Engine
app.post('/api/inventory/stock-adjustment', async (req, res) => {
  try {
    const { productId, action, changeQuantity, user = 'Admin', notes = '' } = req.body;

    if (!productId || !action || !changeQuantity) {
      return res.status(400).json({ error: 'productId, action (STOCK_IN / STOCK_OUT), and changeQuantity are required.' });
    }

    const qty = Math.abs(Number(changeQuantity));
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const previousQuantity = product.quantity;
    let newQuantity = previousQuantity;
    let signedDelta = 0;

    if (action === 'STOCK_IN') {
      newQuantity = previousQuantity + qty;
      signedDelta = qty;
    } else if (action === 'STOCK_OUT') {
      if (previousQuantity < qty) {
        return res.status(400).json({
          error: `Insufficient stock! Current stock is ${previousQuantity}, cannot dispatch ${qty} units.`
        });
      }
      newQuantity = previousQuantity - qty;
      signedDelta = -qty;
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be STOCK_IN or STOCK_OUT.' });
    }

    // Update product quantity and status
    product.quantity = newQuantity;
    if (newQuantity === 0) {
      product.status = 'Out of Stock';
    } else if (newQuantity <= product.minStockAlert) {
      product.status = 'Low Stock';
    } else {
      product.status = 'In Stock';
    }

    const updatedProduct = await product.save();

    // Create Audit History
    const historyEntry = await InventoryHistory.create({
      productId: product._id,
      productSku: product.sku,
      productName: product.name,
      action,
      previousQuantity,
      newQuantity,
      quantityChanged: signedDelta,
      user,
      ip: getClientIp(req),
      notes: notes || (action === 'STOCK_IN' ? `Restocked ${qty} units` : `Dispatched ${qty} units`),
      timestamp: new Date()
    });

    res.json({
      success: true,
      product: updatedProduct,
      movement: historyEntry
    });
  } catch (error) {
    console.error('Error during stock adjustment:', error);
    res.status(500).json({ error: error.message || 'Failed to complete stock movement' });
  }
});

// Inventory Audit History
app.get('/api/inventory/history', async (req, res) => {
  try {
    const { action, search, limit = 50 } = req.query;
    const filter = {};

    if (action && action !== 'All') {
      filter.action = action;
    }

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { productSku: { $regex: search, $options: 'i' } },
        { user: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const history = await InventoryHistory.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.json(history);
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    res.status(500).json({ error: 'Failed to retrieve inventory history' });
  }
});

// Suppliers CRUD
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, categories, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });

    const supplier = new Supplier({
      name: name.trim(),
      contactPerson,
      email,
      phone,
      address,
      categories: Array.isArray(categories) ? categories : (categories ? [categories] : []),
      status: status || 'Active'
    });

    const saved = await supplier.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to save supplier' });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ message: 'Supplier deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Seed Database Route
app.post('/api/seed', async (req, res) => {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const result = await seedDatabase(true);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server and Connect to MongoDB
async function startServer() {
  try {
    if (isProduction) {
      const missing = ['MONGO_URI', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SESSION_SECRET']
        .filter(name => !process.env[name]);
      if (missing.length) throw new Error(`Missing required production settings: ${missing.join(', ')}`);
      if (process.env.ADMIN_PASSWORD.length < 16) {
        throw new Error('ADMIN_PASSWORD must contain at least 16 characters in production');
      }
      if (process.env.SESSION_SECRET.length < 32) {
        throw new Error('SESSION_SECRET must contain at least 32 characters in production');
      }
    }

    await mongoose.connect(MONGO_URI);
    console.log(`Successfully connected to MongoDB at ${MONGO_URI}`);

    // Auto-seed if database is empty
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('Database is empty. Automatically seeding 25 retail products...');
      await seedDatabase(false);
    } else {
      console.log(`Loaded ${productCount} existing products.`);
    }

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` Retail Inventory Backend Server running on port ${PORT}`);
      console.log(` REST API: http://localhost:${PORT}/api/dashboard/stats`);
      console.log(` Health:   http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
