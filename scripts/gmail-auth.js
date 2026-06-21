#!/usr/bin/env node
/**
 * Gmail OAuth Token Generator (googleapis)
 * Reads credentials from .env — never hardcodes secrets.
 *
 * Usage:
 *   1. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in your .env
 *   2. node scripts/gmail-auth.js
 *   3. Paste the refresh token into GMAIL_ACCOUNTS in .env
 */

import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'readline';

const CLIENT_ID     = process.env.GMAIL_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const REDIRECT_URL  = 'http://localhost:3000/auth/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Missing credentials in .env');
  console.error('   Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET first.\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function getRefreshToken() {
  console.log('\n🔐 Gmail OAuth Token Generator');
  console.log('================================\n');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent'
  });

  console.log('📱 Open this URL in your browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('✅ After authorizing, copy the "code" parameter from the redirect URL.\n');

  rl.question('🔑 Paste the authorization code here: ', async (code) => {
    try {
      console.log('\n⏳ Exchanging code for tokens...\n');
      const { tokens } = await oauth2Client.getToken(code);

      console.log('\n✨ SUCCESS! Add this to your .env:\n');
      console.log('════════════════════════════════════════');
      console.log(`\nGMAIL_ACCOUNTS=your-email@gmail.com:Inbox:${tokens.refresh_token}\n`);
      console.log('════════════════════════════════════════\n');

      rl.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      rl.close();
      process.exit(1);
    }
  });
}

getRefreshToken();
