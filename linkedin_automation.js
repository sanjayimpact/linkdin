import fs from 'fs';
import puppeteer from 'puppeteer';
import cron from 'node-cron';
import axios from 'axios';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COOKIE_PATH = 'cookies.json';
const FOLLOW_UP_MESSAGES = [
  "Just checking in 🙂",
  "Thought I’d follow up – anything I can support with?",
  "Circling back on my last message."
];
let token  ="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2ltcGFjdG1pbmR6LmluL2NsaWVudC9zY2FsZWxlYWRzL2FwaS9sb2dpbiIsImlhdCI6MTc0NzIyMTcyMywiZXhwIjoxNzQ3MjIzNTIzLCJuYmYiOjE3NDcyMjE3MjMsImp0aSI6InU3cGw1a0hzdXVBSkllTlUiLCJzdWIiOiIzMyIsInBydiI6IjIzYmQ1Yzg5NDlmNjAwYWRiMzllNzAxYzQwMDg3MmRiN2E1OTc2ZjciLCJlbWFpbCI6IkRlbHRhQGdtYWlsLmNvbSIsImZvcm1fZmlsbGVkIjp0cnVlfQ.gRuSTv6qA60IPELuBfGxrel1To6uMiMZDzw2FoVju8c"

async function loadLeads() {
try {
    const response = await axios.get('https://impactmindz.in/client/scaleleads/api/linkedin/leads', {
      headers: {
        Authorization: `Bearer ${token}`, // Replace if required
      }
    });
    return response.data.leads || []; // assuming leads are inside `leads` key
  } catch (err) {
    console.error('❌ Failed to fetch leads from API:', err.message);
    return [];
  }
}

function saveLeads(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDaysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function randomDelay(min = 30000, max = 90000) {
  return new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function sendLinkedInMessage(page, profileUrl, message) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button[aria-label^="Message"]', { timeout: 10000 });
    await page.click('button[aria-label^="Message"]');
    await page.waitForSelector('div.msg-form__contenteditable', { timeout: 10000 });
    await page.type('div.msg-form__contenteditable', message, { delay: 50 });
    await page.click('button.msg-form__send-button');
    console.log(`✅ Message sent to ${profileUrl}`);
  } catch (err) {
    console.error(`❌ Failed to send message to ${profileUrl}`, err);
  }
}

const run = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const cookies = path.join(__dirname, "cookies.json")
  await page.setCookie(...cookies);
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

  let leads = loadLeads();
  const now = new Date();

  // 1. Update connections (detect newly accepted requests)
  console.log('🔄 Checking for new accepted connections...');
  await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mn-connection-card__details', { timeout: 15000 });

const connected = await page.evaluate(() => {
  const data = [];
  const cards = document.querySelectorAll('.mn-connection-card');

  cards.forEach(card => {
    const nameEl = card.querySelector('.mn-connection-card__name');
    const anchor = card.querySelector('a.mn-connection-card__link');

    const name = nameEl?.innerText?.trim();
    const profileUrl = anchor?.href?.split('?')[0] || '';

    if (name && profileUrl) {
      data.push({ name, profileUrl });
    }
  });

  return data;
});


  let updated = 0;
  for (let lead of leads) {
    if (lead.connectedAt) continue;
    const match = connected.find(conn => conn.name === lead.name || conn.profileUrl === lead.url);
    console.log(match);
    if (match) {
      lead.connectedAt = new Date().toISOString();
      updated++;
      console.log(`✅ Marked connected: ${lead.name}`);
    }
  }

  // 2. Send first message only if 40 minutes have passed
  console.log('✉️ Sending scheduled messages');
  for (const lead of leads) {
    if (lead.replied || !lead.connectedAt || lead.firstMessageSent) continue;

    const connectedTime = new Date(lead.connectedAt);
    const diffInMinutes = (now - connectedTime) / (1000 * 60);

    if (diffInMinutes >= 40) {
      await sendLinkedInMessage(page, lead.url, 'Hey there! Glad to connect 🙂');
      lead.firstMessageSent = true;
      await randomDelay();
    }
  }

  saveLeads(leads);
  await browser.close();
};

cron.schedule('*/1 * * * *', () => {
  console.log('🕐 Running LinkedIn automation job every 5 minutes...');
  run();
});

