#!/usr/bin/env node
/**
 * Gmail OAuth Token Generator (Device Flow)
 * Reads credentials from .env — never hardcodes secrets.
 *
 * Usage:
 *   1. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in your .env
 *   2. node scripts/gmail-auth-device-flow.js
 *   3. Paste the refresh token into GMAIL_ACCOUNTS in .env
 */

import 'dotenv/config';
import axios from 'axios';
import readline from 'readline';

const CLIENT_ID     = process.env.GMAIL_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Missing credentials in .env');
  console.error('   Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET first.\n');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function pollForToken(deviceCode, interval) {
  const maxAttempts = 120;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      return await axios.post('https://oauth2.googleapis.com/token', {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      });
    } catch (error) {
      const code = error.response?.data?.error;
      if (code === 'authorization_pending') {
        await new Promise(r => setTimeout(r, interval * 1000));
        attempts++;
      } else if (code === 'slow_down') {
        await new Promise(r => setTimeout(r, (interval + 5) * 1000));
        attempts++;
      } else {
        throw error;
      }
    }
  }
  console.error('❌ Authorization timeout');
  return null;
}

async function main() {
  try {
    console.log('\n🔐 Gmail OAuth Token Generator (Device Flow)');
    console.log('═══════════════════════════════════════════════\n');

    const { data } = await axios.post('https://oauth2.googleapis.com/device/code', {
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/gmail.readonly'
    });

    console.log(`📱 Open: ${data.verification_url}`);
    console.log(`🔑 Enter code: ${data.user_code}\n`);
    console.log(`⏱️  Expires in ${data.expires_in}s\n`);

    await question('✅ Press Enter after you authorize in your browser...');
    console.log('\n⏳ Waiting for authorization...\n');

    const tokenResponse = await pollForToken(data.device_code, data.interval || 5);
    if (tokenResponse) {
      const tokens = tokenResponse.data;
      console.log('\n✨ SUCCESS! Add this to your .env:\n');
      console.log('═══════════════════════════════════════════════');
      console.log(`\nGMAIL_ACCOUNTS=your-email@gmail.com:Inbox:${tokens.refresh_token}\n`);
      console.log('═══════════════════════════════════════════════\n');
    }

    rl.close();
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.error || error.message);
    rl.close();
    process.exit(1);
  }
}

main();
