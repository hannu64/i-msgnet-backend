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

// Create table
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    encrypted TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Table create error:', err));

// Auto-delete: older than 24h (or change to 8 days inactivity later)
app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  try {
    // Delete old messages (24h example)
    await pool.query(
      `DELETE FROM messages 
       WHERE chat_id = $1 AND timestamp < NOW() - INTERVAL '24 hours'`,
      [chatId]
    );

    // Get remaining
    const result = await pool.query(
      'SELECT encrypted, timestamp FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC',
      [chatId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

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
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
