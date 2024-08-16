import express, { Request, Response } from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import puppeteer from 'puppeteer-core';
import mysql from 'mysql';

const app = express();
const port = 3000;

// Middleware untuk parsing JSON
app.use(express.json());

// Setup MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'whatsapp_sessions' // Nama database yang Anda gunakan untuk menyimpan sesi
});

// Inisialisasi WhatsApp Client dengan LocalAuth untuk penyimpanan sesi dan Puppeteer
let client: Client;

function createClient() {
  client = new Client({
    webVersionCache: {
      type: 'none'
    },
    authStrategy: new LocalAuth({
      clientId: 'client-one',
      dataPath: './.wwebjs_auth/session'
    }),
    puppeteer: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: false, // Bisa diubah ke false untuk debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('Client is ready!');
  });

  client.on('authenticated', (session) => {
    console.log('AUTHENTICATED');
    console.log(session);
    saveSessionToDB(session); // Simpan session setelah berhasil login
  });

  client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
  });

  client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    deleteSessionFromDB(); // Hapus session setelah logout
  });

  client.initialize();
}

// Function untuk menyimpan session ke MySQL
function saveSessionToDB(session: any) {
  if (session) {
    const serializedSession = JSON.stringify(session);
    const sql = `INSERT INTO whatsapp_sessions (session_data) VALUES (?)`;
    connection.query(sql, [serializedSession], (error, results, fields) => {
      if (error) {
        console.error('Error saving session to database:', error);
      } else {
        console.log('Session saved to database');
      }
    });
  } else {
    console.error('Session is null or undefined, not saving to database');
  }
}

// Function untuk memulihkan session dari MySQL
function restoreSessionFromDB() {
  const sql = `SELECT session_data FROM whatsapp_sessions ORDER BY id DESC LIMIT 1`;
  connection.query(sql, (error, results, fields) => {
    if (error) {
      console.error('Error restoring session from database:', error);
      createClient(); // Jika terjadi error, inisialisasi klien WhatsApp
    } else if (results.length > 0) {
      const session = JSON.parse(results[0].session_data);
      console.log('Session restored from database');
      createClient(); // Inisialisasi klien WhatsApp
    } else {
      console.log('No session found in database');
      createClient(); // Jika tidak ada sesi, tetap inisialisasi klien WhatsApp
    }
  });
}

// Function untuk menghapus session dari MySQL
function deleteSessionFromDB() {
  const sql = `DELETE FROM whatsapp_sessions`;
  connection.query(sql, (error, results, fields) => {
    if (error) {
      console.error('Error deleting session from database:', error);
    } else {
      console.log('Session deleted from database');
    }
  });
}

// Inisialisasi client WhatsApp dari session yang tersimpan di MySQL
restoreSessionFromDB();

app.get('/', (req: Request, res: Response) => {
  res.send('WhatsApp Web API');
});

app.post('/send-message', async (req: Request, res: Response) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).send({ error: 'Number and message are required' });
  }

  try {
    const chatId = `${number}@c.us`; // Format nomor telepon ke ID chat
    await client.sendMessage(chatId, message);
    res.status(200).send({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send({ success: false, error: 'Failed to send message' });
  }
});

app.post('/send-otp', async (req, res) => {
  const { number, otp } = req.body;
  
  try {
      const chatId = `${number}@c.us`; // WhatsApp format for number
      await client.sendMessage(chatId, `Your OTP code is: ${otp}`);
      res.status(200).json({ message: 'OTP sent successfully', otp });
  } catch (error) {
      res.status(500).json({ message: 'Failed to send OTP', error });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
