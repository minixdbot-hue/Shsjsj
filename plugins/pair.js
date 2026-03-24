import { Module } from '../lib/plugins.js';

Module({
  command: "pair",
  package: "general",
  description: "Generate WhatsApp pairing code via Heroku API",
})(async (message, match) => {
  try {
    // Extract phone number from message
    const phoneNumber = match.trim();
    
    // Check if number was provided
    if (!phoneNumber || phoneNumber.length < 6) {
      return await message.conn.sendMessage(message.from, {
        text: `❌ *Incorrect Usage*\n\nFormat: *.pair 50935662593*\n\nEnter your WhatsApp number without + sign (ex: 50935662593, 5511999999999)`,
        mimetype: "text/plain"
      });
    }
    
    // Validate phone number (digits only)
    if (!/^[0-9]{6,15}$/.test(phoneNumber)) {
      return await message.conn.sendMessage(message.from, {
        text: `❌ *Invalid Number*\n\nNumber must contain 6-15 digits.\nExamples: 50935662593, 5511999999999, 9234275812345`,
        mimetype: "text/plain"
      });
    }
    
    // Heroku API URL
    const HEROKU_URL = 'https://mini.inconnu.vezxa.com';
    
    // Send waiting message
    await message.conn.sendMessage(message.from, {
      text: `⏳ *Generating pairing code...*\n\nNumber: ${phoneNumber}\nPlease wait...`,
      mimetype: "text/plain"
    });
    
    // Call Heroku API to generate pairing code
    let response;
    try {
      // Use fetch to call API
      const apiUrl = `${HEROKU_URL}/pair/${phoneNumber}`;
      response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.ok && data.code) {
        const pairingCode = data.code;
        
        // Success message with pairing code
        const successMessage = `
✅ *Pairing Code Generated Successfully!*

📱 *Number:* ${phoneNumber}
🔑 *Pairing Code:* \`${pairingCode}\`

*How to use:*
1. Open WhatsApp
2. Go to → Settings
3. → Linked Devices
4. → Link a Device
5. → Pair using code
6. Enter the code above

⚡ *Code valid for 2 minutes*
Thank you for using inconnu xd
        `.trim();
        
        // Try to start session too
        try {
          await fetch(`${HEROKU_URL}/start/${phoneNumber}`);
        } catch (startError) {
          console.log("Session start optional:", startError.message);
        }
        
        // Send message with code
        await message.conn.sendMessage(message.from, {
          text: successMessage,
          mimetype: "text/plain"
        });
        
      } else {
        throw new Error(data.error || 'Failed to generate code');
      }
      
    } catch (apiError) {
      console.error("API Error:", apiError);
      
      // Detailed error message
      let errorMsg = `❌ *Heroku API Error*\n\n`;
      
      if (apiError.message.includes('fetch')) {
        errorMsg += `Cannot reach Heroku server.\n`;
        errorMsg += `URL: ${HEROKU_URL}\n`;
        errorMsg += `Please check if server is online.`;
      } else {
        errorMsg += `${apiError.message}\n`;
        errorMsg += `Number: ${phoneNumber}`;
      }
      
      await message.conn.sendMessage(message.from, {
        text: errorMsg,
        mimetype: "text/plain"
      });
    }
    
  } catch (err) {
    console.error("Pair command error:", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
      mimetype: "text/plain"
    });
  }
});
