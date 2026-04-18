const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const db = new Database(path.join(__dirname, 'tracking.db'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---- DATABASE SETUP ----
db.exec(`
  CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT UNIQUE NOT NULL,
    sender_name TEXT,
    recipient_name TEXT,
    origin TEXT,
    destination TEXT,
    status TEXT DEFAULT 'Pending',
    weight REAL,
    service_type TEXT,
    estimated_delivery TEXT,
    lat REAL,
    lng REAL,
    location_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add columns if upgrading from old DB (safe to run every time)
const addColSafe = (col, type) => {
  try { db.exec(`ALTER TABLE shipments ADD COLUMN ${col} ${type}`); } catch(e) {}
};
addColSafe('lat', 'REAL');
addColSafe('lng', 'REAL');
addColSafe('location_name', 'TEXT');
addColSafe('sender_name', 'TEXT');
addColSafe('recipient_name', 'TEXT');
addColSafe('origin', 'TEXT');
addColSafe('destination', 'TEXT');
addColSafe('weight', 'REAL');
addColSafe('service_type', 'TEXT');
addColSafe('estimated_delivery', 'TEXT');

// ---- ROUTES ----

// Home page
app.get('/', (req, res) => {
  res.render('index');
});

// Track a shipment (GET /track?trackingNumber=xxx)
app.get('/track', (req, res) => {
  const { trackingNumber } = req.query;
  const shipment = db.prepare(
    'SELECT * FROM shipments WHERE tracking_number = ?'
  ).get(trackingNumber);
  res.render('result', { shipment: shipment || null });
});

// Admin dashboard
app.get('/admin', (req, res) => {
  const shipments = db.prepare('SELECT * FROM shipments ORDER BY created_at DESC').all();
  res.render('admin', { shipments });
});

// Add a new shipment
app.post('/add-shipment', (req, res) => {
  const {
    tracking_number, sender_name, recipient_name,
    origin, destination, status, weight,
    service_type, estimated_delivery
  } = req.body;

  try {
    db.prepare(`
      INSERT INTO shipments
        (tracking_number, sender_name, recipient_name, origin, destination,
         status, weight, service_type, estimated_delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tracking_number, sender_name, recipient_name,
      origin, destination, status || 'Pending',
      weight, service_type, estimated_delivery
    );
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Update shipment location (called from admin map)
app.post('/update-location', (req, res) => {
  const { trackingNumber, lat, lng, locationName, status } = req.body;

  const existing = db.prepare(
    'SELECT id FROM shipments WHERE tracking_number = ?'
  ).get(trackingNumber);

  if (!existing) {
    return res.json({ success: false, message: 'Tracking number not found' });
  }

  if (status) {
    db.prepare(`
      UPDATE shipments SET lat = ?, lng = ?, location_name = ?, status = ?
      WHERE tracking_number = ?
    `).run(lat, lng, locationName, status, trackingNumber);
  } else {
    db.prepare(`
      UPDATE shipments SET lat = ?, lng = ?, location_name = ?
      WHERE tracking_number = ?
    `).run(lat, lng, locationName, trackingNumber);
  }

  res.json({ success: true });
});

// ---- START SERVER ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SwiftFreight running on http://localhost:${PORT}`);
});