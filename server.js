const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

// Store recent chat messages in memory
const chatHistory = [];


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('./snippets.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS snippets (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL
    )`);
    
    // Tracker for the next available ID
    db.run(`CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
    )`);
    
    // Initialize next_id to 111 if it doesn't exist
    db.get(`SELECT value FROM meta WHERE key = 'next_id'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO meta (key, value) VALUES ('next_id', 111)`);
        }
    });
});

app.post('/api/share', (req, res) => {
    const { code } = req.body;
    if (!code || code.trim() === '') {
        return res.status(400).json({ error: 'A kód megadása kötelező' });
    }

    db.serialize(() => {
        // Use a transaction-like approach or just serialize
        db.get(`SELECT value FROM meta WHERE key = 'next_id'`, (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const nextId = row.value;
            
            db.run(`INSERT INTO snippets (id, code) VALUES (?, ?)`, [nextId, code], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                // Increment next_id
                db.run(`UPDATE meta SET value = value + 1 WHERE key = 'next_id'`, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: nextId, url: `/${nextId}` });
                });
            });
        });
    });
});

app.get('/api/code/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Érvénytelen azonosító formátum' });
    }
    
    db.get(`SELECT code FROM snippets WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!row) {
            return res.status(404).json({ error: 'A kód nem található vagy már megtekintették' });
        }
        
        const code = row.code;
        
        // Delete immediately (burn after reading)
        db.run(`DELETE FROM snippets WHERE id = ?`, [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ code });
        });
    });
});

// Serve the index.html for all frontend routes (SPA)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO Chat logic
io.on('connection', (socket) => {
    // Send history to new user
    socket.emit('chatHistory', chatHistory);

    socket.on('sendMessage', (msg) => {
        const messageData = {
            id: Date.now(),
            text: msg.text,
            time: new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
        };
        
        // Keep only last 50 messages
        chatHistory.push(messageData);
        if (chatHistory.length > 50) chatHistory.shift();

        // Broadcast to everyone
        io.emit('newMessage', messageData);
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
