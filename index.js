const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create table if not exists (already done, but safe)
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    encrypted TEXT NOT NULL,
    sender TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lifespan_hours INTEGER
  );
`, (err) => {
  if (err) console.error('Table creation error:', err);
});

// POST /api/messages - send a message
app.post('/api/messages', async (req, res) => {
  const { chatId, encrypted, lifespanHours } = req.body;

  if (!chatId || !encrypted) {
    return res.status(400).json({ error: 'Missing chatId or encrypted' });
  }

  try {
    await pool.query(
      'INSERT INTO messages (chat_id, encrypted, lifespan_hours) VALUES ($1, $2, $3)',
      [chatId, encrypted, lifespanHours] // lifespanHours can be null
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('POST error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// GET /api/messages/:chatId - get messages (delete expired first)
app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  try {
    // Delete expired messages
    const deleteResult = await pool.query(`
      DELETE FROM messages 
      WHERE chat_id = $1 
      AND lifespan_hours IS NOT NULL 
      AND created_at + (lifespan_hours * INTERVAL '1 hour') < NOW()
      RETURNING encrypted
    `, [chatId]);

    console.log(`Deleted ${deleteResult.rowCount} expired messages for chatId: ${chatId}`, deleteResult.rows);

    // Return remaining
    const result = await pool.query(
      'SELECT encrypted, sender, timestamp FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC',
      [chatId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// DELETE /api/messages/:chatId/:encrypted - delete specific message
app.delete('/api/messages/:chatId/:encrypted', async (req, res) => {
  const { chatId, encrypted } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM messages WHERE chat_id = $1 AND encrypted = $2',
      [chatId, encrypted]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
