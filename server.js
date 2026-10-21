// server.js - Frendzy Core Backend API (Vercel Serverless Version)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'frendzy_super_secret_key_2026'; 
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');

const app = express();

// ==========================================
// 1. MIDDLEWARE
// ==========================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(express.static('public'));

// ==========================================
// 2. DATABASE SCHEMAS & MODELS
// ==========================================

const userSchema = new mongoose.Schema({
    name: String,
    phone: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['FARMER', 'BUYER'], required: true },
    current_otp: String 
});
const User = mongoose.model('User', userSchema);

// 📦 Unified Category Schema & Model
const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    target: { type: String, required: true, enum: ['SUPPLIER', 'FARMER', 'MACHINERY'], default: 'SUPPLIER' },
    icon: { type: String, default: 'fa-seedling' },
    color: { type: String, default: 'text-green-600' },
    bg: { type: String, default: 'bg-green-50' },
    created_at: { type: Date, default: Date.now }
});
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

const cropSchema = new mongoose.Schema({
    listing_id: String,
    farmer_id: String,
    listing_type: { type: String, default: 'STANDARD' },
    product_details: {
        category: String,
        crop_name: String,
        farming_method: String
    },
    harvest_data: {
        estimated_harvest_date: Date,
        total_yield_kg: Number,
        available_yield_kg: Number
    },
    pricing: { 
        market_price_per_kg: Number,
        market_price_linked: { type: Boolean, default: false }
    },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number] 
    },
    address_text: String,
    status: { type: String, default: 'GROWING' }, 
    image_url: String,
    farmer_phone: String
});
cropSchema.index({ location: '2dsphere' });
const Crop = mongoose.models.Crop || mongoose.model('Crop', cropSchema);

const supplierSchema = new mongoose.Schema({
    shop_name: String,
    owner_name: String,
    phone: String,
    pin: String,
    address: String,
    location: String,
    lat: Number, 
    lng: Number,
    payment_options: [String],
    createdAt: { type: Date, default: Date.now }
});
const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);

const inputSchema = new mongoose.Schema({
    product_name: String,
    category: String,
    unit_size: { type: String, default: '1 Unit' },
    price: Number,
    supplier_phone: String, 
    supplier_name: String,
    image_url: String,
    is_organic: { type: Boolean, default: false },
    quantity: { type: Number, default: 0 } 
});
const AgriInput = mongoose.models.AgriInput || mongoose.model('AgriInput', inputSchema);

const orderSchema = new mongoose.Schema({
    status: { type: String, default: 'Pending' }, 
    total_price: Number,  
    createdAt: { type: Date, default: Date.now },
    buyer_phone: String,
    buyer_id: String,
    crop_name: String,
    price_per_kg: Number,
    quantity_kg: Number,
    farmer_phone: String, 
    order_type: String,   
    advance_paid: Number, 
    item_name: String,
    quantity: Number,
    supplier_phone: String
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

const DriverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    dl_number: { type: String },
    vehicle_type: { type: String },
    rc_number: { type: String },
    dl_photo: { type: String },
    rc_photo: { type: String },
    pin: { type: String, required: true }
});
const Driver = mongoose.models.Driver || mongoose.model('Driver', DriverSchema);

// 🚜 Machinery Schema & Model
const MachinerySchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    rate: { type: Number, required: true },
    unit: { type: String, required: true },
    provider_phone: { type: String, required: true },
    image_url: { type: String },
    created_at: { type: Date, default: Date.now }
});
const Machinery = mongoose.models.Machinery || mongoose.model('Machinery', MachinerySchema);

// 🚜 Machinery Booking Schema & Model
const MachineryBookingSchema = new mongoose.Schema({
    machinery_id: { type: String, required: true },
    machinery_name: { type: String, required: true },
    provider_phone: { type: String, required: true },
    farmer_phone: { type: String, required: true },
    rate: { type: Number, required: true },
    unit: { type: String, required: true },
    status: { type: String, default: 'PENDING' },
    created_at: { type: Date, default: Date.now }
});
const MachineryBooking = mongoose.models.MachineryBooking || mongoose.model('MachineryBooking', MachineryBookingSchema);

// 🚚 Logistics Booking Schema & Model
const LogisticsBookingSchema = new mongoose.Schema({
    item_name: { type: String, required: true },
    quantity_kg: { type: Number, required: true },
    pickup_location: { type: String, required: true },
    drop_location: { type: String, required: true },
    requester_phone: { type: String, required: true },
    requester_role: { type: String, required: true },
    vehicle_required: { type: String, default: 'Small Tempo / Mini Truck' },
    status: { type: String, default: 'PENDING_DISPATCH' },
    driver_phone: { type: String, default: null },
    created_at: { type: Date, default: Date.now }
});
const LogisticsBooking = mongoose.models.LogisticsBooking || mongoose.model('LogisticsBooking', LogisticsBookingSchema);


// ==========================================
// 3. DATABASE CONNECTION MIDDLEWARE (Vercel Optimized)
// ==========================================
const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    if (!MONGO_URI) {
        throw new Error('Please define the MONGO_URI environment variable');
    }
    await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to Frendzy Database');
}

// Automatically connect before any route handles a request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});


// ==========================================
// 4. API ROUTES
// ==========================================

// --- ROOT CHECK ROUTE ---
app.get('/', (req, res) => {
    res.json({ message: "Frendzy Backend API is running successfully!" });
});

// --- ADMIN: GLOBAL CATEGORIES (GET, POST, DELETE) ---
app.get('/api/admin/categories', async (req, res) => {
    try {
        const { target } = req.query;
        let query = target ? { target } : {};
        let categories = await Category.find(query);

        if (categories.length === 0 && !target) {
            const defaultCategories = [
                { name: 'Seeds', target: 'SUPPLIER', icon: 'fa-seedling', color: 'text-green-600', bg: 'bg-green-50' },
                { name: 'Pesticides', target: 'SUPPLIER', icon: 'fa-spray-can', color: 'text-red-600', bg: 'bg-red-50' },
                { name: 'Fertilizers', target: 'SUPPLIER', icon: 'fa-flask', color: 'text-blue-600', bg: 'bg-blue-50' },
                { name: 'Fruits', target: 'FARMER', icon: 'fa-apple-alt', color: 'text-red-500', bg: 'bg-red-50' },
                { name: 'Vegetables', target: 'FARMER', icon: 'fa-carrot', color: 'text-orange-500', bg: 'bg-orange-50' },
                { name: 'Tractors', target: 'MACHINERY', icon: 'fa-tractor', color: 'text-sky-600', bg: 'bg-sky-50' },
                { name: 'Harvesters', target: 'MACHINERY', icon: 'fa-wheat-awn', color: 'text-amber-600', bg: 'bg-amber-50' }
            ];
            await Category.insertMany(defaultCategories);
            categories = await Category.find(query);
        }
        res.json(categories);
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.post('/api/admin/categories', async (req, res) => {
    try {
        const { name, target, icon, color, bg } = req.body;
        if (!name || !target) {
            return res.status(400).json({ error: "Name and target are required" });
        }

        const existing = await Category.findOne({ name, target });
        if (existing) {
            return res.status(400).json({ error: "Category already exists for this target" });
        }

        const newCategory = new Category({ name, target, icon, color, bg });
        await newCategory.save();
        res.status(201).json({ message: "Category created successfully", category: newCategory });
    } catch (err) {
        console.error("Error creating category:", err);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

app.delete('/api/admin/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        console.error("Error deleting category:", err);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// --- AUTHENTICATION ---
app.post('/api/signup', async (req, res) => {
    try {
        const { name, phone, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, phone, password: hashedPassword, role });
        await newUser.save();
        res.status(201).json({ message: "User registered successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Could not register. Phone number might already exist." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ error: "Account not found." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password." });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
        res.status(200).json({ token, user: { name: user.name, phone: user.phone, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: "Login failed." });
    }
});

// --- FARMER: CROP LISTINGS & GPS ---
app.post('/api/crops/voice-listing', async (req, res) => {
    try {
        const { crop_name, yield_kg, price, lat, lng, address_text, listing_type, estimated_harvest_date, market_price_linked, category } = req.body;
        const newCrop = new Crop({
            listing_id: `LST-${Math.floor(Math.random() * 10000)}`,
            farmer_id: 'FMR-1029', 
            listing_type: listing_type || 'STANDARD',
            product_details: { crop_name, category: category || 'Vegetables' },
            harvest_data: { 
                total_yield_kg: yield_kg, 
                available_yield_kg: yield_kg,
                estimated_harvest_date: estimated_harvest_date ? new Date(estimated_harvest_date) : null
            },
            pricing: { 
                market_price_per_kg: price || 0,
                market_price_linked: market_price_linked || false
            },
            image_url: req.body.image_url,
            farmer_phone: req.body.farmer_phone,
            address_text: address_text || 'Farm Location',
            location: { coordinates: [Number(lng) || 77.5946, Number(lat) || 12.9716] }
        });
        await newCrop.save();
        res.status(201).json({ message: "Crop listed successfully with GPS!", data: newCrop });
    } catch (error) { res.status(500).json({ error: "Failed to list crop" }); }
});

app.get('/api/crops/feed', async (req, res) => {
    try {
        const localCrops = await Crop.find({ status: 'GROWING' }); 
        res.status(200).json({ results: localCrops.length, data: localCrops });
    } catch (error) { res.status(500).json({ error: "Failed to fetch feed" }); }
});

app.delete('/api/crops/:id', async (req, res) => {
    try {
        await Crop.findByIdAndDelete(req.params.id);
        res.json({ message: 'Crop deleted' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete' }); }
});

// --- ORDERS & LOGISTICS ---
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.status(201).json(newOrder);
    } catch (error) { res.status(500).json({ error: 'Order error' }); }
});

app.get('/api/orders/pending', async (req, res) => {
    try {
        const orders = await Order.find({ status: "Pending" }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) { res.status(500).json({ error: "Fetch error" }); }
});

app.patch('/api/orders/:id/accept', async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: "ACCEPTED" });
        res.status(200).json({ message: "Accepted" });
    } catch (error) { res.status(500).json({ error: "Action failed" }); }
});

// --- SUPPLIER ROUTES ---
app.post('/api/supplier/login', async (req, res) => {
    try {
        const supplier = await Supplier.findOne({ phone: req.body.phone, pin: req.body.pin });
        if (supplier) res.json(supplier); else res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/supplier/setup', async (req, res) => {
    try {
        let supplier = await Supplier.findOne({ phone: req.body.phone });
        if (!supplier) supplier = new Supplier(req.body); else Object.assign(supplier, req.body);
        await supplier.save();
        res.json(supplier);
    } catch (err) { res.status(500).json({ error: 'Setup failed' }); }
});

app.get('/api/supplier/inventory/:phone', async (req, res) => {
    try {
        res.json(await AgriInput.find({ supplier_phone: req.params.phone }));
    } catch (err) { res.status(500).json({ error: 'Inventory error' }); }
});

app.get('/api/inputs', async (req, res) => {
    try {
        res.json(await AgriInput.find());
    } catch (err) { res.status(500).json({ error: 'Inputs error' }); }
});

app.post('/api/inputs', async (req, res) => {
    try {
        const newItem = new AgriInput(req.body);
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) { res.status(500).json({ error: 'Add product error' }); }
});

app.patch('/api/inputs/:id/stock', async (req, res) => {
    try {
        const item = await AgriInput.findByIdAndUpdate(req.params.id, { quantity: req.body.quantity }, { new: true });
        res.json(item);
    } catch (err) { res.status(500).json({ error: 'Stock error' }); }
});

app.get('/api/supplier/orders/:phone', async (req, res) => {
    try {
        res.json(await Order.find({ supplier_phone: req.params.phone, status: 'Pending' }));
    } catch (error) { res.status(500).json({ error: 'Orders error' }); }
});

// --- MACHINERY ROUTES ---
app.get('/api/machinery', async (req, res) => {
    try {
        const list = await Machinery.find({});
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch machinery list" });
    }
});

app.post('/api/machinery', async (req, res) => {
    try {
        const { name, category, rate, unit, provider_phone, image_url } = req.body;
        const newItem = new Machinery({ name, category, rate, unit, provider_phone, image_url });
        await newItem.save();
        res.status(201).json({ message: "Machinery listed successfully", item: newItem });
    } catch (err) {
        res.status(500).json({ error: "Failed to save machinery listing" });
    }
});

app.post('/api/machinery/book', async (req, res) => {
    try {
        const { machinery_id, machinery_name, provider_phone, farmer_phone, rate, unit } = req.body;
        const newBooking = new MachineryBooking({ machinery_id, machinery_name, provider_phone, farmer_phone, rate, unit });
        await newBooking.save();
        res.status(201).json({ message: "Booking request sent successfully!", booking: newBooking });
    } catch (err) {
        res.status(500).json({ error: "Failed to process machinery booking" });
    }
});

app.get('/api/machinery/bookings/:phone', async (req, res) => {
    try {
        const bookings = await MachineryBooking.find({ provider_phone: req.params.phone });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

app.patch('/api/machinery/bookings/:id/accept', async (req, res) => {
    try {
        const updated = await MachineryBooking.findByIdAndUpdate(req.params.id, { status: 'ACCEPTED' }, { new: true });
        res.json({ message: "Booking accepted", booking: updated });
    } catch (err) {
        res.status(500).json({ error: "Failed to accept booking" });
    }
});

// --- LOGISTICS ROUTES ---
app.post('/api/logistics/request', async (req, res) => {
    try {
        const newLogistics = new LogisticsBooking(req.body);
        await newLogistics.save();
        res.status(201).json({ message: "Logistics requested successfully", booking: newLogistics });
    } catch (err) {
        res.status(500).json({ error: "Failed to request logistics support" });
    }
});

app.get('/api/logistics/feed', async (req, res) => {
    try {
        const dispatches = await LogisticsBooking.find({ status: 'PENDING_DISPATCH' });
        res.json(dispatches);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch logistics feed" });
    }
});

app.patch('/api/logistics/:id/accept', async (req, res) => {
    try {
        const { driver_phone } = req.body;
        const updated = await LogisticsBooking.findByIdAndUpdate(req.params.id, { status: 'ACCEPTED', driver_phone }, { new: true });
        res.json({ message: "Job accepted by driver", booking: updated });
    } catch (err) {
        res.status(500).json({ error: "Failed to accept job" });
    }
});

// ==========================================
// 5. LOCAL DEV FALLBACK & VERCEL EXPORT
// ==========================================
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    connectDB().then(() => {
        app.listen(PORT, () => console.log(`🚜 Server running locally on port ${PORT}`));
    });
}

// Export app for Vercel Serverless Functions
module.exports = app;