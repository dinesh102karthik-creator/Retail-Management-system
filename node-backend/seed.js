const mongoose = require('mongoose');
const Product = require('./models/Product');
const Supplier = require('./models/Supplier');
const InventoryHistory = require('./models/InventoryHistory');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/retail_inventory';

const initialSuppliers = [
  {
    name: 'Global Grain Co',
    contactPerson: 'David Miller',
    email: 'sales@globalgrain.com',
    phone: '+1-555-0143',
    address: '104 Harborside Blvd, Chicago, IL',
    categories: ['Grocery'],
    status: 'Active'
  },
  {
    name: 'Mediterranean Imports',
    contactPerson: 'Elena Rossi',
    email: 'contact@medimports.com',
    phone: '+1-555-0182',
    address: '77 Olive Way, New York, NY',
    categories: ['Grocery'],
    status: 'Active'
  },
  {
    name: 'Andes Bean Roasters',
    contactPerson: 'Carlos Santana',
    email: 'orders@andesbean.com',
    phone: '+1-555-0199',
    address: '320 Highland Rd, Seattle, WA',
    categories: ['Beverages'],
    status: 'Active'
  },
  {
    name: 'GreenHome Essentials',
    contactPerson: 'Sarah Jenkins',
    email: 'info@greenhome.org',
    phone: '+1-555-0215',
    address: '88 Eco Park, Austin, TX',
    categories: ['Household', 'Personal Care'],
    status: 'Active'
  },
  {
    name: 'Meadow Gold Farms',
    contactPerson: 'Robert Brown',
    email: 'supply@meadowgoldfarms.com',
    phone: '+1-555-0240',
    address: '12 Valley Vista, Madison, WI',
    categories: ['Dairy'],
    status: 'Active'
  },
  {
    name: 'Heritage Bakery',
    contactPerson: 'Claire Dupont',
    email: 'claire@heritagebakers.com',
    phone: '+1-555-0288',
    address: '45 Artisan Way, Portland, OR',
    categories: ['Bakery'],
    status: 'Active'
  },
  {
    name: 'WriteFlow Instruments',
    contactPerson: 'Marcus Vance',
    email: 'orders@writeflow.com',
    phone: '+1-555-0312',
    address: '900 Silicon Ave, San Jose, CA',
    categories: ['Stationery'],
    status: 'Active'
  }
];

const initialProducts = [
  { sku: 'GRO-101', name: 'Royal Basmati Rice 5kg', category: 'Grocery', price: 18.99, costPrice: 14.20, quantity: 45, minStockAlert: 15, supplier: 'Global Grain Co', barcode: '890123456701', location: 'Aisle 1-A' },
  { sku: 'GRO-102', name: 'Organic Olive Oil 1L', category: 'Grocery', price: 12.50, costPrice: 9.00, quantity: 28, minStockAlert: 10, supplier: 'Mediterranean Imports', barcode: '890123456702', location: 'Aisle 1-B' },
  { sku: 'GRO-103', name: 'Whole Wheat Pasta 500g', category: 'Grocery', price: 2.49, costPrice: 1.50, quantity: 60, minStockAlert: 20, supplier: 'Pasta Bella Ltd', barcode: '890123456703', location: 'Aisle 1-C' },
  { sku: 'GRO-104', name: 'Himalayan Pink Salt 1kg', category: 'Grocery', price: 3.99, costPrice: 2.10, quantity: 8, minStockAlert: 12, supplier: 'Pure Earth Spices', barcode: '890123456704', location: 'Aisle 1-D' },
  { sku: 'BEV-201', name: 'Arabica Dark Roast Coffee Beans 500g', category: 'Beverages', price: 14.99, costPrice: 10.00, quantity: 32, minStockAlert: 10, supplier: 'Andes Bean Roasters', barcode: '890123456705', location: 'Aisle 2-A' },
  { sku: 'BEV-202', name: 'Organic Green Tea 50 Bags', category: 'Beverages', price: 5.99, costPrice: 3.60, quantity: 40, minStockAlert: 15, supplier: 'Herbal Valley', barcode: '890123456706', location: 'Aisle 2-B' },
  { sku: 'BEV-203', name: 'Sparkling Spring Water 750ml', category: 'Beverages', price: 1.99, costPrice: 0.95, quantity: 75, minStockAlert: 25, supplier: 'Alpine Springs', barcode: '890123456707', location: 'Aisle 2-C' },
  { sku: 'BEV-204', name: 'Cold Pressed Orange Juice 1L', category: 'Beverages', price: 4.50, costPrice: 2.80, quantity: 6, minStockAlert: 10, supplier: 'Sun Orchard Co', barcode: '890123456708', location: 'Aisle 2-D' },
  { sku: 'SNA-301', name: 'Roasted Almonds 250g', category: 'Snacks', price: 6.99, costPrice: 4.50, quantity: 55, minStockAlert: 15, supplier: 'Nut Harvest', barcode: '890123456709', location: 'Aisle 3-A' },
  { sku: 'SNA-302', name: 'Dark Chocolate Bar 85% 100g', category: 'Snacks', price: 3.49, costPrice: 2.00, quantity: 35, minStockAlert: 12, supplier: 'Swiss Cacao Works', barcode: '890123456710', location: 'Aisle 3-B' },
  { sku: 'SNA-303', name: 'Artisan Potato Crisps Sea Salt 150g', category: 'Snacks', price: 2.99, costPrice: 1.60, quantity: 0, minStockAlert: 15, supplier: 'Crispy Farm', barcode: '890123456711', location: 'Aisle 3-C' },
  { sku: 'PER-401', name: 'Moisturizing Shea Butter Lotion 400ml', category: 'Personal Care', price: 8.99, costPrice: 5.20, quantity: 24, minStockAlert: 10, supplier: 'Botanica Naturals', barcode: '890123456712', location: 'Aisle 4-A' },
  { sku: 'PER-402', name: 'Natural Bamboo Toothbrush (Pack of 4)', category: 'Personal Care', price: 6.49, costPrice: 3.20, quantity: 38, minStockAlert: 15, supplier: 'EcoSmile Care', barcode: '890123456713', location: 'Aisle 4-B' },
  { sku: 'PER-403', name: 'Tea Tree Herbal Shampoo 300ml', category: 'Personal Care', price: 7.50, costPrice: 4.30, quantity: 5, minStockAlert: 10, supplier: 'Pure Herbs Lab', barcode: '890123456714', location: 'Aisle 4-C' },
  { sku: 'HOU-501', name: 'Eco Dishwashing Liquid Lavender 500ml', category: 'Household', price: 3.79, costPrice: 2.10, quantity: 42, minStockAlert: 12, supplier: 'GreenHome Essentials', barcode: '890123456715', location: 'Aisle 5-A' },
  { sku: 'HOU-502', name: 'Recycled Paper Towels (6 Rolls)', category: 'Household', price: 9.99, costPrice: 6.50, quantity: 30, minStockAlert: 10, supplier: 'GreenHome Essentials', barcode: '890123456716', location: 'Aisle 5-B' },
  { sku: 'HOU-503', name: 'All-Purpose Surface Cleaner 750ml', category: 'Household', price: 4.29, costPrice: 2.50, quantity: 0, minStockAlert: 10, supplier: 'CleanPro Corp', barcode: '890123456717', location: 'Aisle 5-C' },
  { sku: 'STA-601', name: 'Hardcover Notebook A5 Dotted', category: 'Stationery', price: 7.99, costPrice: 4.20, quantity: 45, minStockAlert: 15, supplier: 'Nordic Paperworks', barcode: '890123456718', location: 'Aisle 6-A' },
  { sku: 'STA-602', name: 'Fine Gel Pens 0.5mm (Pack of 8)', category: 'Stationery', price: 5.49, costPrice: 2.80, quantity: 62, minStockAlert: 20, supplier: 'WriteFlow Instruments', barcode: '890123456719', location: 'Aisle 6-B' },
  { sku: 'STA-603', name: 'Ergonomic Desktop Stapler', category: 'Stationery', price: 8.50, costPrice: 4.80, quantity: 4, minStockAlert: 8, supplier: 'WriteFlow Instruments', barcode: '890123456720', location: 'Aisle 6-C' },
  { sku: 'DAI-701', name: 'Farm Fresh Whole Milk 1 Gallon', category: 'Dairy', price: 4.29, costPrice: 2.90, quantity: 22, minStockAlert: 12, supplier: 'Meadow Gold Farms', barcode: '890123456721', location: 'Cooler 1-A' },
  { sku: 'DAI-702', name: 'Aged Cheddar Cheese Block 250g', category: 'Dairy', price: 5.99, costPrice: 3.70, quantity: 18, minStockAlert: 10, supplier: 'Meadow Gold Farms', barcode: '890123456722', location: 'Cooler 1-B' },
  { sku: 'DAI-703', name: 'Greek Yogurt Plain 500g', category: 'Dairy', price: 3.89, costPrice: 2.40, quantity: 7, minStockAlert: 12, supplier: 'Alpine Dairy', barcode: '890123456723', location: 'Cooler 1-C' },
  { sku: 'BAK-801', name: 'Sourdough Artisan Bread Loaf', category: 'Bakery', price: 4.99, costPrice: 2.50, quantity: 16, minStockAlert: 10, supplier: 'Heritage Bakery', barcode: '890123456724', location: 'Bakery Rack 1' },
  { sku: 'BAK-802', name: 'Butter Croissants (Pack of 4)', category: 'Bakery', price: 5.49, costPrice: 3.10, quantity: 0, minStockAlert: 8, supplier: 'Heritage Bakery', barcode: '890123456725', location: 'Bakery Rack 2' }
];

async function seedDatabase(force = false) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }

    const count = await Product.countDocuments();
    if (count > 0 && !force) {
      console.log(`Database already contains ${count} products. Skipping seed.`);
      return { message: 'Database already populated', count };
    }

    if (force) {
      await Product.deleteMany({});
      await Supplier.deleteMany({});
      await InventoryHistory.deleteMany({});
      console.log('Cleared existing database records for fresh seed.');
    }

    // Seed Suppliers
    await Supplier.insertMany(initialSuppliers);
    console.log(`Seeded ${initialSuppliers.length} suppliers.`);

    // Seed Products & Calculate Status
    const createdProducts = [];
    for (const p of initialProducts) {
      let status = 'In Stock';
      if (p.quantity === 0) status = 'Out of Stock';
      else if (p.quantity <= p.minStockAlert) status = 'Low Stock';

      const product = await Product.create({
        ...p,
        status
      });
      createdProducts.push(product);

      // Create initial audit trail entry
      await InventoryHistory.create({
        productId: product._id,
        productSku: product.sku,
        productName: product.name,
        action: 'PRODUCT_CREATED',
        previousQuantity: 0,
        newQuantity: product.quantity,
        quantityChanged: product.quantity,
        user: 'System Admin',
        ip: '127.0.0.1',
        notes: `Initial catalog seed with starting quantity of ${product.quantity} units`,
        timestamp: new Date()
      });
    }

    // Add a few realistic movement entries for history realism
    const rice = createdProducts.find(p => p.sku === 'GRO-101');
    if (rice) {
      await InventoryHistory.create({
        productId: rice._id,
        productSku: rice.sku,
        productName: rice.name,
        action: 'STOCK_OUT',
        previousQuantity: 50,
        newQuantity: 45,
        quantityChanged: -5,
        user: 'Store Manager',
        ip: '192.168.1.105',
        notes: 'Direct B2B catering order fulfilled',
        timestamp: new Date(Date.now() - 3600000 * 4)
      });
    }

    const coffee = createdProducts.find(p => p.sku === 'BEV-201');
    if (coffee) {
      await InventoryHistory.create({
        productId: coffee._id,
        productSku: coffee.sku,
        productName: coffee.name,
        action: 'STOCK_IN',
        previousQuantity: 12,
        newQuantity: 32,
        quantityChanged: 20,
        user: 'Receiving Clerk',
        ip: '192.168.1.112',
        notes: 'Shipment PO-9821 received from Andes Bean Roasters',
        timestamp: new Date(Date.now() - 3600000 * 8)
      });
    }

    console.log(`Successfully seeded ${createdProducts.length} retail products with initial audit trails.`);
    return { success: true, productsCount: createdProducts.length };
  } catch (error) {
    console.error('Seeding error:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase(true)
    .then(() => {
      console.log('Seeding process completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
