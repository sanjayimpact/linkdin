import express from 'express';
import bodyParser from 'body-parser';
import { getLiAt } from './puppeteerBot.js';
import { connectAndFollowUp } from './linkedinAutomation.js';

const app = express();

// Middlewares
app.use(bodyParser.json());
app.use(express.static('public'));

// Route to handle form submission and automation start
app.post('/api/automate', async (req, res) => {
  const { email, password, profileUrl, connectMessage, followUpMessage } = req.body;
console.log(req.body);
  if (!email || !password || !profileUrl || !connectMessage || !followUpMessage) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Step 1: Get the 'li_at' cookie
    const liAt = await getLiAt(email, password);

    // Step 2: Start automation for connection + follow-up
    await connectAndFollowUp({
      liAt,
      profileUrl,
      connectMessage,
      followUpMessage,
    });

    res.status(200).json({
      success: true,
      message: 'Automation started successfully! Connection request sent and follow-up will be sent shortly.',
    });
  } catch (err) {
    res.status(500).json({ error: `Automation failed: ${err.message}` });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
