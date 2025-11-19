/* server.js
   Simple Express server with SQLite for students CRUD
   - REST endpoints: GET /api/students, POST /api/students, PUT /api/students/:id, DELETE /api/students/:id
   - Serves static UI from /public
   - Basic server-side validation and simple logging
*/
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database (file-based SQLite)
const DB_PATH = path.join(__dirname, 'db', 'students.db');
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'db'))) fs.mkdirSync(path.join(__dirname, 'db'));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open DB:', err);
    process.exit(1);
  }
  console.info('Connected to SQLite DB at', DB_PATH);
});

// Create table if not exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      email TEXT,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Create table error:', err);
  });

  // Insert sample row only if table empty
  db.get('SELECT COUNT(1) as c FROM students', (err, row) => {
    if (!err && row && row.c === 0) {
      const sample = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'John Doe',
        address: 'Example Address',
        city: 'Example City',
        state: 'example State',
        email: 'example@example.com',
        phone: '9009009009'
      };
      db.run(
        `INSERT INTO students (id,name,address,city,state,email,phone) VALUES (?,?,?,?,?,?,?)`,
        [sample.id, sample.name, sample.address, sample.city, sample.state, sample.email, sample.phone]
      );
    }
  });
});

// Simple logging middleware
app.use((req, res, next) => {
  console.info(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- API endpoints ---

// GET all students
app.get('/api/students', (req, res) => {
  db.all('SELECT * FROM students ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('DB read error:', err);
      return res.status(500).json({ error: 'DB read error' });
    }
    res.json(rows);
  });
});

// GET single student
app.get('/api/students/:id', (req, res) => {
  db.get('SELECT * FROM students WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB read error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

// Helper validators for create/update
const studentValidators = [
  body('name').trim().isLength({ min: 3 }).withMessage('Name mínimo 3 caracteres'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido'),
  body('phone').optional({ checkFalsy: true }).matches(/^[0-9]{7,15}$/).withMessage('Teléfono: 7-15 dígitos')
];

// Create student
app.post('/api/students', studentValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const id = require('crypto').randomUUID();
  const { name, address, city, state, email, phone } = req.body;

  db.run(
    `INSERT INTO students (id,name,address,city,state,email,phone) VALUES (?,?,?,?,?,?,?)`,
    [id, name, address || '', city || '', state || '', email || '', phone || ''],
    function(err) {
      if (err) {
        console.error('DB insert error:', err);
        return res.status(500).json({ error: 'DB insert error' });
      }
      db.get('SELECT * FROM students WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB read error' });
        res.status(201).json(row);
      });
    }
  );
});

// Update student
app.put('/api/students/:id', studentValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { name, address, city, state, email, phone } = req.body;
  const id = req.params.id;

  db.run(
    `UPDATE students SET name=?, address=?, city=?, state=?, email=?, phone=? WHERE id=?`,
    [name, address || '', city || '', state || '', email || '', phone || '', id],
    function(err) {
      if (err) {
        console.error('DB update error:', err);
        return res.status(500).json({ error: 'DB update error' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      db.get('SELECT * FROM students WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB read error' });
        res.json(row);
      });
    }
  );
});

// Delete student
app.delete('/api/students/:id', (req, res) => {
  db.run('DELETE FROM students WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('DB delete error:', err);
      return res.status(500).json({ error: 'DB delete error' });
    }
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });
});

// Export all data (JSON) - useful para backup / migración
app.get('/api/export', (req, res) => {
  db.all('SELECT * FROM students', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB read error' });
    res.setHeader('Content-Disposition', 'attachment; filename=students.json');
    res.json(rows);
  });
});

// Basic health endpoint
app.get('/health', (req, res) => res.json({ ok: true }));

// Serve index.html for root (static folder already configured)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
