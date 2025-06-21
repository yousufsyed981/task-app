const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const app = express();

// --- CONFIG ---
const API_KEY = 'f8932A02-9b4f-44ef-92b1-2f7c0example'; // Change this to your secret key
const METADATA_FILE = 'uploads/metadata.json';

// Enable CORS for all origins
app.use(cors());

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Create unique filename using timestamp and original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Initialize multer with storage configuration
const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// --- Helper: Load and Save Metadata ---
function loadMetadata() {
    if (!fs.existsSync(METADATA_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch {
        return [];
    }
}
function saveMetadata(metadata) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// --- Middleware: API Key Check ---
function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    if (key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    next();
}

// --- Handle file upload (secured) ---
app.post('/api/upload', requireApiKey, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const deviceId = req.headers['x-device-id'] || 'unknown';
        const timestamp = new Date().toISOString();
        const filename = req.file.filename;
        const filePath = `/uploads/${filename}`;
        // Load metadata
        let metadata = loadMetadata();
        // Avoid duplicates (by filename and deviceId)
        if (!metadata.some(m => m.filename === filename && m.deviceId === deviceId)) {
            metadata.push({ filename, path: filePath, deviceId, timestamp });
            saveMetadata(metadata);
        }
        res.json({
            message: 'File uploaded successfully',
            filename,
            path: filePath
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- List uploads as JSON ---
app.get('/api/list-uploads', (req, res) => {
    const metadata = loadMetadata();
    res.json(metadata);
});

// --- Admin dashboard ---
app.get('/dashboard', (req, res) => {
    const metadata = loadMetadata();
    const html = `
    <html><head><title>Uploads Dashboard</title>
    <style>
      body { font-family: sans-serif; margin: 2em; }
      .gallery { display: flex; flex-wrap: wrap; gap: 16px; }
      .item { border: 1px solid #ccc; padding: 8px; border-radius: 8px; width: 200px; }
      .item img { max-width: 100%; border-radius: 4px; }
      .meta { font-size: 0.9em; color: #555; margin-top: 4px; }
    </style>
    </head><body>
    <h1>Uploads Dashboard</h1>
    <div class="gallery">
      ${metadata.map(m => `
        <div class="item">
          <img src="${m.path}" alt="${m.filename}" />
          <div class="meta">${m.filename}<br>Device: ${m.deviceId}<br>${m.timestamp}</div>
        </div>
      `).join('')}
    </div>
    </body></html>
    `;
    res.send(html);
});

// Error handling middleware
app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
