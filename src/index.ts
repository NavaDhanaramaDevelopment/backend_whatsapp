import express, { Request, Response } from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const allowedOrigins = ['https://frontend-whatsapp-icongrosir.vercel.app', 'http://localhost:3000'];
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Replace with your React app's URL
    methods: ['GET', 'POST']
  }
});
const port = 3099;

// Middleware for parsing JSON and handling CORS
app.use(express.json());
app.use(cors({
  origin: allowedOrigins // Replace with your React app's URL
}));

let isLoggedIn = false; // State to track login status

// Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'client-one',
    dataPath: './.wwebjs_auth/session'
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  io.emit('qr', qr); // Emit QR code to frontend
});

client.on('ready', () => {
  console.log('Client is ready!');
  io.emit('ready'); // Notify frontend that client is ready
});

client.on('authenticated', () => {
  console.log('AUTHENTICATED');
  isLoggedIn = true; // Update login status
  io.emit('authenticated'); // Notify frontend that client is authenticated
});

client.on('auth_failure', (msg) => {
  console.error('AUTHENTICATION FAILURE', msg);
  io.emit('auth_failure', msg); // Notify frontend of authentication failure
});

client.on('disconnected', (reason) => {
  console.log('Client was logged out', reason);
  isLoggedIn = false; // Update login status
  io.emit('disconnected', reason); // Notify frontend of disconnection
});

client.initialize().catch(error => {
  console.error('Error initializing client:', error);
});

app.get('/', (req: Request, res: Response) => {
  res.send('WhatsApp Web API');
});

app.get('/status', (req: Request, res: Response) => {
  res.status(200).json({ isLoggedIn }); // Return login status
});

app.post('/send-message', async (req: Request, res: Response) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).send({ error: 'Number and message are required' });
  }

  try {
    const formattedNumber = number.startsWith('0') ? `62${number.slice(1)}` : number;
    const chatId = `${formattedNumber}@s.whatsapp.net`;

    await client.sendMessage(chatId, message);
    res.status(200).send({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send({ success: false, error: 'Failed to send message' });
  }
});

app.post('/send-otp', async (req: Request, res: Response) => {
  const { number, otp } = req.body;

  if (!number || !otp) {
    return res.status(400).send({ error: 'Number and OTP are required' });
  }

  try {
    const formattedNumber = number.startsWith('0') ? `62${number.slice(1)}` : number;
    const chatId = `${formattedNumber}@s.whatsapp.net`;
    
    await client.sendMessage(chatId, `Your OTP code is: ${otp}`);
    res.status(200).json({ message: 'OTP sent successfully', otp });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Failed to send OTP', error });
  }
});

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
