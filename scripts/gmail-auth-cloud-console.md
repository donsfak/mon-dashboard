# Gmail OAuth Token - Google Cloud Console Method

**The issue**: The redirect URI `http://localhost:3000/auth/callback` isn't registered in Google Cloud Console.

## Simple Solution: Use Google Cloud Console's Test Feature

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com/

2. **Navigate to APIs & Services > OAuth consent screen**
   - Make sure your test email (falibetasoro@gmail.com) is added as a test user

3. **Go to APIs & Services > Credentials**
   - Find your OAuth 2.0 Client (ID: 614004632155-6u1bpk99dlquuucdns8v75jgsu8t433u.apps.googleusercontent.com)
   - Click on it to edit

4. **Add Authorized redirect URIs**
   - Add this URI: `http://localhost:3000/auth/callback`
   - Click Save

5. **Then try the OAuth flow again**
   - Run: `node scripts/gmail-auth.js`
   - Click the URL and authorize

## Alternative: Use Device Flow (No Redirect)

If you prefer, we can modify the script to use Google's Device Flow instead, which doesn't require a redirect URI.

Just let me know which approach you prefer!
