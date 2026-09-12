# Settlem Academy — Razorpay Setup

Razorpay's current Node.js integration requires creating an order server-side, passing the order ID to Checkout, then verifying the returned payment signature on the server. Amounts are sent in currency subunits (₹299 => 29900). 

Official docs:
- https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

## Environment
Set in production:
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

Use Razorpay TEST keys first. Never put the secret key in frontend code.

## Current Settlem Academy flow
Student → course-payment.html → POST /api/payments/order → Razorpay Checkout → POST /api/payments/verify → verified payment → enrollment created.

The course price is determined by the server-side course catalog, not by a browser-supplied amount.
