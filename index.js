require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// ============================================================================
// 1. Google Sheets Setup
// ============================================================================
async function initGoogleSheets() {
    // Authenticate using a Service Account configured in Google Cloud
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // The private key might contain escaped newlines (\n) when loaded from .env
        key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo(); // Ensure we can connect to the document
    return doc;
}

// ============================================================================
// 2. WhatsApp Client Setup
// ============================================================================
const client = new Client({
    authStrategy: new LocalAuth(), // Saves the session so you don't rescan every time
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Helps prevent certain chromium errors
    }
});

client.on('qr', (qr) => {
    // Generate QR code to terminal. First run only.
    console.log('Scan the QR code below with your WhatsApp app on your phone:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.clear();
    console.log('✅ Puppy Tracker Bot is connected and ready! 🐶');
    console.log('Listening for messages...');
});

// ============================================================================
// 3. Message Listener and Parsing Logic
// ============================================================================
client.on('message_create', async (msg) => {
    // Only log if the message has content to avoid spam
    if (msg.body && msg.body.trim().length > 0) {
        console.log(`[DEBUG] Received a message from: ${msg.from}`);
        console.log(`[DEBUG] Message content: "${msg.body}"`);
    }
    // ------------------------------------------------------------------------
    // Utility: Find Group ID
    // ------------------------------------------------------------------------
    // Send "!groupid" in any chat (including the specific group) 
    // to make the bot reply with the exact Chat/Group ID.
    if (msg.body === '!groupid') {
        console.log("Received !groupid in chat:", (await msg.getChat()).name);
        const chat = await msg.getChat();
        await msg.reply(`The ID of this chat is:\n*${chat.id._serialized}*`);
        return;
    }

    // ------------------------------------------------------------------------
    // Target Group Filtering
    // ------------------------------------------------------------------------
    const targetGroupId = process.env.TARGET_GROUP_ID;

    // If the message is from YOU, msg.to contains the group ID.
    // If the message is from someone else, msg.from contains the group ID.
    const chatId = msg.fromMe ? msg.to : msg.from;

    // Quick debug to see what string we get for each message:
    // console.log(`[DEBUG] Comparing Chat ID: "${chatId}" === Target ID: "${targetGroupId}"`);

    if (targetGroupId && chatId !== targetGroupId) {
        // We log ignored messages but skip saving them
        // console.log(`[DEBUG] Ignoring message from different chat.`);
        return;
    }

    // ------------------------------------------------------------------------
    // Parsing Logic
    // ------------------------------------------------------------------------
    const body = msg.body.trim();

    // Regex matches "קקי", "פיפי", "אוכל", or "טיול", followed by 1 or more spaces, and exactly 4 digits.
    // E.g., "קקי 0630" -> match[1] = "קקי", match[2] = "0630"
    const regex = /^(קקי|פיפי|אוכל|טיול)\s+(\d{4})$/;
    const match = body.match(regex);

    if (match) {
        const keyword = match[1];
        const rawTime = match[2]; // e.g. "0630"

        // Format the time as HH:MM
        const timeValue = `${rawTime.substring(0, 2)}:${rawTime.substring(2, 4)}`;

        try {
            // Get today's local date (DD/MM/YYYY)
            const today = new Date();
            const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

            // Format precise timestamp (e.g. 15/03/2026, 14:32:01)
            const loggedAtStr = today.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });

            // Initialize connection to Google Sheet directly here (or globally)
            const doc = await initGoogleSheets();
            const sheet = doc.sheetsByIndex[0]; // Gets the first worksheet

            // The google-spreadsheet library requires a header row to exist before
            // adding rows by object or even array sometimes.
            try {
                await sheet.loadHeaderRow();
            } catch (e) {
                // If the header row throws an error (e.g. "No values in the header row"),
                // it means the sheet is completely empty. We must initialize it!
                console.log('Sheet is empty. Initializing header row...');
                await sheet.setHeaderRow(['Date', 'Time', 'Action', 'Logged At']);
            }

            // Format: [Date (DD/MM/YYYY), Time (from message), Action (keyword), Logged At (system timestamp)]
            await sheet.addRow([dateStr, timeValue, keyword, loggedAtStr]);

            console.log(`📝 Logged successfully: [${dateStr}] [${timeValue}] ${keyword}`);

            // React to the message with a checkmark instead of sending a new text message
            await msg.react('✅');

        } catch (error) {
            console.error('❌ Failed to write to Google Sheets:', error);
            await msg.reply('אירעה שגיאה ברישום בגוגל שיטס. אנא בדקו את הלוגים.');
        }
    }
});

// Start the client
try {
    client.initialize();
} catch (error) {
    console.error('Failed to initialize client:', error);
}
