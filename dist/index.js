"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode = __importStar(require("qrcode-terminal"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const allowedOrigins = ['https://frontend-whatsapp-tau.vercel.app', 'http://localhost:3000'];
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins, // Replace with your React app's URL
        methods: ['GET', 'POST']
    }
});
const port = 3099;
// Middleware for parsing JSON and handling CORS
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: allowedOrigins // Replace with your React app's URL
}));
let isLoggedIn = false; // State to track login status
// Initialize WhatsApp Client
const client = new whatsapp_web_js_1.Client({
    authStrategy: new whatsapp_web_js_1.LocalAuth({
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
app.get('/', (req, res) => {
    res.send('WhatsApp Web API');
});
app.get('/status', (req, res) => {
    res.status(200).json({ isLoggedIn }); // Return login status
});
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
        return res.status(400).send({ error: 'Number and message are required' });
    }
    try {
        const formattedNumber = number.startsWith('0') ? `62${number.slice(1)}` : number;
        const chatId = `${formattedNumber}@s.whatsapp.net`;
        await client.sendMessage(chatId, message);
        res.status(200).send({ success: true, message: 'Message sent successfully' });
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send({ success: false, error: 'Failed to send message' });
    }
});
app.post('/send-otp', async (req, res) => {
    const { number, otp } = req.body;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }
    try {
        const formattedNumber = number.startsWith('0') ? `62${number.slice(1)}` : number;
        const chatId = `${formattedNumber}@s.whatsapp.net`;
        await client.sendMessage(chatId, `Your OTP code is: ${otp}`);
        res.status(200).json({ message: 'OTP sent successfully', otp });
    }
    catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Failed to send OTP', error });
    }
});
server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
