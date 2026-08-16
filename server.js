// Simple Node/Express backend to receive quote requests and send a WhatsApp notification via Twilio
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const submissionsFile = path.join(__dirname, 'submissions.json');

// Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID; // from .env
const authToken = process.env.TWILIO_AUTH_TOKEN;   // from .env
const twilioFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+1415XXXXXXX'
const notifyTo = process.env.NOTIFY_WHATSAPP_TO; // e.g. 'whatsapp:+918369740626' (site owner)

let twilioClient = null;
if (accountSid && authToken) {
  const twilio = require('twilio');
  twilioClient = twilio(accountSid, authToken);
}

function saveSubmission(data){
  try{
    let existing = [];
    if (fs.existsSync(submissionsFile)){
      existing = JSON.parse(fs.readFileSync(submissionsFile, 'utf8') || '[]');
    }
    existing.push(data);
    fs.writeFileSync(submissionsFile, JSON.stringify(existing, null, 2));
  } catch(err){
    console.error('Failed to save submission', err);
  }
}

app.post('/api/quotes', async (req, res) => {
  const { name, phone, insurance } = req.body || {};
  if (!name || !phone || !insurance) return res.status(400).json({ ok:false, error: 'Missing fields' });

  const timestamp = new Date().toISOString();
  const submission = { name, phone, insurance, timestamp, source: req.ip };

  // Save locally
  saveSubmission(submission);

  // Send WhatsApp via Twilio (if configured)
  if (twilioClient && twilioFrom && notifyTo){
    const messageBody = `New quote request:\nName: ${name}\nPhone: ${phone}\nInsurance: ${insurance}\nTime: ${timestamp}`;
    try{
      await twilioClient.messages.create({
        from: twilioFrom,
        to: notifyTo,
        body: messageBody
      });
    } catch(err){
      console.error('Twilio send error:', err);
      // continue — we already saved the submission
    }
  } else {
    console.warn('Twilio not configured. Check environment variables.');
  }

  return res.status(201).json({ ok:true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
