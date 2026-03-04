const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');
const fs = require('fs');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/tasks'];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function authenticate() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
    );

    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });

    console.log('Authorize this app by visiting this url:', authorizeUrl);

    const server = http.createServer(async (req, res) => {
        try {
            if (req.url.indexOf('/oauth2callback') > -1) {
                const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
                const code = qs.get('code');
                res.end('Authentication successful! Please return to the console.');
                server.close();
                const { tokens } = await oauth2Client.getToken(code);
                console.log('\n--- NEW GOOGLE_REFRESH_TOKEN ---');
                console.log(tokens.refresh_token);
                console.log('-------------------------------\n');
            }
        } catch (e) {
            console.error(e);
        }
    }).listen(3000);

    const { default: open } = await import('open');
    await open(authorizeUrl);
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
    process.exit(1);
}

authenticate();
