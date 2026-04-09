require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.set('strictQuery', false);

mongoose.connection.on('connected', () => console.log('Mongoose default connection open'));
mongoose.connection.on('error', (err) => console.error('Mongoose default connection error: ' + err));
mongoose.connection.on('disconnected', () => console.log('Mongoose default connection disconnected'));

console.log("Attempting to connect to MongoDB...");
mongoose.connect(mongodb+srv://omkar200:vip200@cluster0.vt8rzcj.mongodb.net/ambuquick?appName=Cluster0, {
    serverSelectionTimeoutMS: 100000, // Keep trying to connect for 5 seconds
    socketTimeoutMS: 450000, // Close sockets after 45 seconds of inactivity
})
.then(() => {
    console.log("Connected to MongoDB via Mongoose");
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`AmbuQuick API running on http://localhost:${PORT}`);
    });
})
.catch(err => {
    console.error("MongoDB Connection error:", err);
    process.exit(1); // Exit if we can't connect
});

// --- Schemas ---
const UserSchema = new mongoose.Schema({
    role: { type: String, enum: ['patient', 'driver'], required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // In production, hash this with bcrypt!
    phone: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const RequestSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pickupLocation: { type: String, required: true },
    emergencyType: { type: String, required: true },
    notes: String,
    status: { type: String, enum: ['pending', 'accepted', 'completed', 'cancelled'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
const EmergencyRequest = mongoose.model('EmergencyRequest', RequestSchema);

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { role, fullName, email, password, phone } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "Email already in use" });
        
        const user = new User({ role, fullName, email, password, phone });
        await user.save();
        res.status(201).json({ message: "User created successfully", userId: user._id, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password }); // plaintext check for prototype simplicity
        if (!user) return res.status(401).json({ error: "Invalid credentials" });
        
        res.status(200).json({ message: "Login successful", userId: user._id, role: user.role, fullName: user.fullName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SOS Request Routes ---
app.post('/api/sos/request', async (req, res) => {
    try {
        const { patientId, pickupLocation, emergencyType, notes } = req.body;
        const request = new EmergencyRequest({ patientId, pickupLocation, emergencyType, notes });
        await request.save();
        res.status(201).json({ message: "Emergency request created", request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sos/history/:patientId', async (req, res) => {
    try {
        const history = await EmergencyRequest.find({ patientId: req.params.patientId }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// For drivers to fetch pending requests
app.get('/api/sos/pending', async (req, res) => {
    try {
        const pending = await EmergencyRequest.find({ status: 'pending' }).populate('patientId', 'fullName phone').sort({ createdAt: -1 });
        res.status(200).json(pending);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Driver accepting a request
app.post('/api/sos/accept', async (req, res) => {
    try {
        const { requestId, driverId } = req.body;
        const request = await EmergencyRequest.findByIdAndUpdate(requestId, { status: 'accepted', driverId }, { new: true });
        res.status(200).json({ message: "Request accepted", request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


