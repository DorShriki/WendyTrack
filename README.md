# WendyTrack - WhatsApp to Google Sheets Automation

This project automatically detects keywords (`קקי`, `פיפי`, `אוכל`) followed by a timestamp in a designated WhatsApp group and logs them directly to a Google Spreadsheet.

## Prerequisites

1.  **Node.js**: Make sure you have Node > 16.0 installed.
2.  **Google Cloud Console Account**: For Google Sheets API.
3.  **A Google Spreadsheet**: Create a new file in your personal Google Drive for this. Set up columns `Date`, `Time`, `Action`, and `Logged At` in the first row.

---

## Step 1: Google Cloud Setup (Service Account)

To write to a Google Sheet programmatically without a complex OAuth pop-up, we use a Service Account.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a **New Project** (e.g., "PuppyTracker").
3.  Go to **APIs & Services > Library**.
4.  Search for **Google Sheets API** and click **Enable**.
5.  Go to **APIs & Services > Credentials**.
6.  Click **Create Credentials** -> **Service account**.
7.  Give it a name (e.g., `puppy-bot`) and click **Create and Continue**, then **Done**.
8.  In the list of service accounts, click on the newly created one.
9.  Go to the **Keys** tab -> **Add Key** -> **Create new key**.
10. Choose **JSON** and click **Create**. A JSON file containing your credentials will download to your computer.

### Connecting the Service Account to your Sheet
1. Open the downloaded JSON file. Pick out two things: `client_email` and `private_key`.
2. Go to your actual Google Spreadsheet.
3. Click the **Share** button in the top right.
4. Paste the `client_email` (looks like `puppy-bot@puppytracker-123.iam.gserviceaccount.com`) and grant it **Editor** permissions. This gives the bot the right to edit *this specific sheet*.

---

## Step 2: Publish Your Sheet for the Dashboard

To allow the static GitHub Pages dashboard to securely read your data without a backend server, we use Google's "Publish to Web" CSV feature.

1. In your Google Spreadsheet, click **File** > **Share** > **Publish to web**.
2. Under "Link", change "Entire Document" to the specific sheet (e.g., "Sheet1").
3. Change "Web page" to **Comma-separated values (.csv)**.
4. Click **Publish**. 
5. Copy the generated URL.
6. Open `docs/app.js` in this project, and paste that URL into the `GOOGLE_SHEET_CSV_URL` variable at the very top of the file!

---

## Step 3: Environment Variables

1. Copy `.env.example` to a new file named `.env`.
   ```bash
   cp .env.example .env
   ```
2. Open your `.env` file and fill in the values:
   - `SPREADSHEET_ID`: Extract this from your spreadsheet's URL. e.g., for `https://docs.google.com/spreadsheets/d/1BxiMVs0X.../edit`, the ID is `1BxiMVs0X...`.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The `client_email` from your JSON downloaded above.
   - `GOOGLE_PRIVATE_KEY`: The `private_key` from the JSON. Make sure you wrap it in quotes and leave the `\n` characters exactly as they are.

---

## Step 4: Finding the WhatsApp Group ID

First, run the bot to authenticate and connect to WhatsApp.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the application:
   ```bash
   npm start
   ```
3. A large QR code will print in the terminal. Open WhatsApp on your phone, go to **Linked Devices**, and scan the QR code.
4. Once connected, open your target group on WhatsApp (e.g., your puppy group with your partner).
5. Send the exact message: `!groupid`
6. The bot will instantly reply: `The ID of this chat is: 1234567890@g.us`.
7. **Stop the script** (Ctrl + C in your terminal).
8. Copy the ID (`1234567890@g.us`) and paste it as the `TARGET_GROUP_ID` in your `.env` file.

---

## Step 5: Running the Bot
Once everything is populated in `.env`, just run it again! The session is saved via `LocalAuth`, so you rarely have to scan the QR code again.

```bash
npm start
```

Whenever anyone explicitly says "קקי 0630" in the puppy group, you'll see a row populate in your spreadsheet instantly, and the bot will reply "הרישום בוצע בהצלחה! 🐶".
