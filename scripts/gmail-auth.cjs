/**
 * Gmail OAuth Token Generator (CLI Mode)
 * Reads credentials from .env — never hardcodes secrets.
 *
 * Usage:
 *   1. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in your .env
 *   2. node scripts/gmail-auth.cjs
 *   3. Paste the refresh token into GMAIL_ACCOUNTS in .env
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const axios = require('axios');
const readline = require('readline');
const querystring = require('querystring');

const CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Missing credentials in .env');
  console.error('   Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET first.\n');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function main() {
  try {
    console.log('\n🔐 Gmail OAuth Token Generator (CLI Mode)');
    console.log('═══════════════════════════════════════════════\n');

    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + querystring.stringify({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent'
    });

    console.log('📱 Open this URL in your browser:\n');
    console.log(`   ${authUrl}\n`);
    console.log('✅ After authorizing, you will see an authorization code.\n');

    const authCode = await question('🔑 Paste the authorization code here: ');
    if (!authCode.trim()) {
      console.error('❌ No authorization code provided');
      rl.close();
      process.exit(1);
    }

    console.log('\n⏳ Exchanging code for tokens...\n');

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: authCode.trim(),
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    });

    const tokens = tokenResponse.data;

    console.log('\n✨ SUCCESS! Add this to your .env:\n');
    console.log('═══════════════════════════════════════════════');
    console.log(`\nGMAIL_ACCOUNTS=your-email@gmail.com:Inbox:${tokens.refresh_token}\n`);
    console.log('═══════════════════════════════════════════════\n');

    rl.close();
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.error_description || error.response?.data?.error || error.message);
    rl.close();
    process.exit(1);
  }
}

main();
