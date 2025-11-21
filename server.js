/* server.js
   Express server with Amazon RDS MariaDB for students CRUD
   - REST endpoints: GET /api/students, POST /api/students, PUT /api/students/:id, DELETE /api/students/:id
   - Serves static UI from /public
   - Basic server-side validation and simple logging
*/
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// RDS MariaDB Connection Configuration
const dbConfig = {
  host: process.env.RDS_HOSTNAME || 'your-rds-endpoint.rds.amazonaws.com',
  port: process.env.RDS_PORT || 3306,
  user: process.env.RDS_USERNAME || 'admin',
  password: process.env.RDS_PASSWORD || 'Mypassw0rd123',
  database: process.env.RDS_DB_NAME || 'students_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Create connection pool
let pool;

async function initializeDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    console.info('✓ Connected to RDS MariaDB');
    connection.release();

    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        city VARCHAR(100),
        state VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.info('✓ Students table ready');

    // Insert sample row only if table empty
    const [rows] = await pool.query('SELECT COUNT(*) as c FROM students');
    if (rows[0].c === 0) {
      const sample = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'John Doe',
        address: 'Example Address',
        city: 'Example City',
        state: 'Example State',
        email: 'example@example.com',
        phone: '9009009009'
      };
      await pool.query(
        `INSERT INTO students (id, name, address, city, state, email, phone) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sample.id, sample.name, sample.address, sample.city, sample.state, sample.email, sample.phone]
      );
      console.info('✓ Sample student created');
    }
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

// Initialize DB before starting server
initializeDatabase();

// Simple logging middleware
app.use((req, res, next) => {
  console.info(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- API endpoints ---

// GET all students
app.get('/api/students', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM students ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('DB read error:', err);
    res.status(500).json({ error: 'DB read error' });
  }
});

// GET single student
app.get('/api/students/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('DB read error:', err);
    res.status(500).json({ error: 'DB read error' });
  }
});

// Helper validators for create/update
const studentValidators = [
  body('name').trim().isLength({ min: 3 }).withMessage('Name mínimo 3 caracteres'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido'),
  body('phone').optional({ checkFalsy: true }).matches(/^[0-9]{7,15}$/).withMessage('Teléfono: 7-15 dígitos')
];

// Create student
app.post('/api/students', studentValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const id = require('crypto').randomUUID();
  const { name, address, city, state, email, phone } = req.body;

  try {
    await pool.query(
      `INSERT INTO students (id, name, address, city, state, email, phone) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, address || '', city || '', state || '', email || '', phone || '']
    );

    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('DB insert error:', err);
    res.status(500).json({ error: 'DB insert error' });
  }
});

// Update student
app.put('/api/students/:id', studentValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { name, address, city, state, email, phone } = req.body;
  const id = req.params.id;

  try {
    const [result] = await pool.query(
      `UPDATE students SET name=?, address=?, city=?, state=?, email=?, phone=? 
       WHERE id=?`,
      [name, address || '', city || '', state || '', email || '', phone || '', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('DB update error:', err);
    res.status(500).json({ error: 'DB update error' });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('DB delete error:', err);
    res.status(500).json({ error: 'DB delete error' });
  }
});

// Export all data (JSON) - useful para backup / migración
app.get('/api/export', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM students');
    res.setHeader('Content-Disposition', 'attachment; filename=students.json');
    res.json(rows);
  } catch (err) {
    console.error('DB read error:', err);
    res.status(500).json({ error: 'DB read error' });
  }
});

// Basic health endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'disconnected' });
  }
});

// Serve index.html for root (static folder already configured)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});