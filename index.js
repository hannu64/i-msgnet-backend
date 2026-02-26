const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create table with timestamp
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    encrypted TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Table create error:', err));

// GET: delete old messages (>24h) and return remaining
app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  try {
    // Delete messages older than 24 hours
    await pool.query(
      `DELETE FROM messages 
       WHERE chat_id = $1 
       AND timestamp < NOW() - INTERVAL '24 hours'`,
      [chatId]
    );

    // Return remaining messages
    const result = await pool.query(
      'SELECT encrypted, timestamp FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC',
      [chatId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST: add new message
app.post('/api/messages', async (req, res) => {
  const { chatId, encrypted } = req.body;
  if (!chatId || !encrypted) return res.status(400).json({ error: 'Missing fields' });

  try {
    await pool.query(
      'INSERT INTO messages (chat_id, encrypted) VALUES ($1, $2)',
      [chatId, encrypted]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
