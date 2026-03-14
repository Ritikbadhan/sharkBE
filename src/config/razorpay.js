const Razorpay = require('razorpay');

function getRazorpayConfig() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET
  };
}

function isRazorpayConfigured() {
  const { keyId, keySecret } = getRazorpayConfig();
  return Boolean(keyId && keySecret);
}

function getRazorpayInstance() {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured');
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

module.exports = {
  getRazorpayConfig,
  isRazorpayConfigured,
  getRazorpayInstance
};
