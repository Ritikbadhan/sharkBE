const https = require('https');

const BREVO_API_HOST = 'api.brevo.com';
const BREVO_API_PATH = '/v3/transactionalSMS/sms';

function sendSms(to, content) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BREVO_API_KEY;
    const sender = process.env.SMS_FROM || 'SHARK';
    if (!apiKey) return reject(new Error('BREVO_API_KEY not configured'));

    const payload = JSON.stringify({
      sender,
      recipient: to,
      content,
    });

    const options = {
      hostname: BREVO_API_HOST,
      path: BREVO_API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'api-key': apiKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            return resolve(JSON.parse(data || '{}'));
          } catch (e) {
            return resolve({ raw: data });
          }
        }
        return reject(new Error(`Brevo SMS send failed (${res.statusCode}): ${data}`));
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

module.exports = { sendSms };
