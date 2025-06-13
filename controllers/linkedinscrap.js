import fs from "fs";
import puppeteer from "puppeteer-core";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config'


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const BROWSER_WS = `${process.env.SCRAPER_URL}` || `wss://brd-customer-hl_b0a0de5f-zone-scraping_browser1:zuh9bm3r1npt@brd.superproxy.io:9222`;
const linkedintokensFile = path.join(__dirname, "linkedin_tokens.json");
const linkedincurrentUserFile = path.join(__dirname, "linkedin_current_users.json");

const linkedinstart = path.join(__dirname, "linkedin_start.json");
const linkedincurrentcompain = path.join(__dirname, "linkedin_campaigns.json");
const simulateHumanBehavior = async (page) => {

  const viewport = await page.viewport();
  // Mouse movement simulation
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * viewport.width);
    const y = Math.floor(Math.random() * viewport.height);
    await page.mouse.move(x, y, { steps: 5 });
     await new Promise(r => setTimeout(r, 1500));
  }

  // Scroll slowly
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 200));
    await new Promise(r => setTimeout(r, 1500));
  }
};



// random delay
const randomDelay = (min, max) =>
  new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1) + min)));



const simulateMouseMove = async (page) => {
  const width = await page.evaluate(() => window.innerWidth);
  const height = await page.evaluate(() => window.innerHeight);
  await page.mouse.move(
    Math.floor(Math.random() * width),
    Math.floor(Math.random() * height)
  );
};

const simulateHumanScroll = async (page) => {
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight / 2)));
    await simulateMouseMove(page);
    await randomDelay(800, 1800);
  }
};


export const linkedinscrap = async (req, res) => {
  const {body} = req.body;
  const{id,company_size,sector,usertoken} = body;
  const myCookies = req.cookies;

  const{sub} = req.user;
  const token = req.token;



  // 1. 🔐 Fetch li_at token from your backend API
  let li_at_token = usertoken;
// add some data before scrapping 
//add linkedin current user 

let currentUsers = [];
if (fs.existsSync(linkedincurrentUserFile)) {
  currentUsers = JSON.parse(fs.readFileSync(linkedincurrentUserFile, "utf-8"));
}
if (!currentUsers.find(u => u.user_id == sub)) {
  currentUsers.push({ user_id: sub, active: true });
  fs.writeFileSync(linkedincurrentUserFile, JSON.stringify(currentUsers, null, 2));
}


//add linkedincompain
let campaigns = [];
if (fs.existsSync(linkedincurrentcompain)) {
  campaigns = JSON.parse(fs.readFileSync(linkedincurrentcompain, "utf-8"));
}
if (!campaigns.find(c => c.cid == id)) {
  campaigns.push({ cid: id, uid: sub, active: true });
  fs.writeFileSync(linkedincurrentcompain, JSON.stringify(campaigns, null, 2));
}

// add token 


let tokens = [];
if (fs.existsSync(linkedintokensFile)) {
  tokens = JSON.parse(fs.readFileSync(linkedintokensFile, "utf-8"));
}
if (!tokens.find(t => t.user_id == sub)) {
  tokens.push({ user_id: sub, token: usertoken });
  fs.writeFileSync(linkedintokensFile, JSON.stringify(tokens, null, 2));
}


//start flag
let startEntries = [];
if (fs.existsSync(linkedinstart)) {
  startEntries = JSON.parse(fs.readFileSync(linkedinstart, "utf-8"));
}
const alreadyExists = startEntries.find(e => e.uid == sub && e.cid == id);
if (!alreadyExists) {
  startEntries.push({ uid: sub, cid: id, start: true });
  fs.writeFileSync(linkedinstart, JSON.stringify(startEntries, null, 2));
}


  try {
    
    if (!li_at_token) throw new Error("Missing li_at token");
  } catch (err) {
    console.error("❌ Failed to fetch li_at token:", err.message);
    return res.status(500).send("Failed to fetch LinkedIn cookie");
  }

  // 2. 🔍 Fetch additional company info
  let leads = [];
  let company_sizes = company_size;
  let company = sector;


  let browser;
  try {


 try{
     browser = await puppeteer.connect({
      browserWSEndpoint: BROWSER_WS
    
    });
     console.log("connected")
 }catch(err){
  console.log(err)
 }
  //  

    const page = await browser.newPage();




    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
    );

      await page.setViewport({ width: 1280, height: 1020 });
    // Set li_at cookie before loading any LinkedIn page
  await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded' });

   console.log("linkedin page")

    // await page.evaluate((token) => {
    //   document.cookie = `li_at=${token}; domain=.linkedin.com; path=/; secure; SameSite=Lax`;
    // }, usertoken);


   await page.setCookie({
  name: 'li_at',
  value: usertoken,
  domain: '.linkedin.com',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
});
   console.log("setCookies")
await page.evaluate(() => location.href = "https://www.linkedin.com/feed");
await page.waitForNavigation({ waitUntil: "domcontentloaded" });

    // 4. 🔗 Open LinkedIn and validate login


    console.log("✅ Logged in successfully using li_at cookie");


await new Promise(r => setTimeout(r, 1500));
    // 5. 🔎 Go to search results
    const searchUrl = `https://www.linkedin.com/search/results/people/?companySize=${company_sizes}&keywords=${encodeURIComponent(company)}`;
    await page.evaluate(url => window.location.href = url, searchUrl);
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });


    let currentPage = 1;
    const maxPages = 1;

    while (currentPage <= maxPages) {


      await page.waitForSelector('ul[role="list"] > li', { timeout: 8000 });

      const scrapedProfiles = await page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('ul[role="list"] > li');
        cards.forEach((card) => {
         card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
});

        cards.forEach((card) => {
          const getText = (selector, root = card) =>
            root.querySelector(selector)?.innerText.trim() || "";
          const mb1Divs = card.querySelectorAll(".mb1 > div");
          const count = mb1Divs.length;
          const Education = mb1Divs[count - 2]?.innerText?.trim() || "";
          const location = mb1Divs[count - 1]?.innerText?.trim() || "";
          const name = getText('span[aria-hidden="true"]');
          const headline = Education;
          const mutual = getText(".entity-result__insights");
          const profileLink = card.querySelector('a[href*="/in/"]')?.href?.split("?")[0] || "";

          results.push({ name, headline, location, Education, mutualConnections: mutual, profileUrl: profileLink });
        });
        return results.slice(0, 25);
      });

      scrapedProfiles.forEach((profile) => {
        if (profile.name && profile.profileUrl) {
          leads.push({
            name: profile.name,
            url: profile.profileUrl,
            headline: profile.headline,
            location: profile.location,
            connectedAt: new Date().toISOString(),
            connectionRequest: false,
            firstMessageSent: false,
            replied: false,
            token:usertoken
          });
        }
      });

      // 🚀 Try to connect with people
      // await page.evaluate(async () => {
      //   const delay = (ms) => new Promise((res) => setTimeout(res, ms));
      //   const buttons = [...document.querySelectorAll('button[aria-label*="to connect"]')];
      //   for (let i = 0; i < buttons.length; i++) {
      //     try {
      //       buttons[i].click();
      //       await delay(1000);
      //       const sendBtn = document.querySelector('button[aria-label="Send without a note"]');
      //       if (sendBtn) {
      //         sendBtn.click();
      //         await delay(1000);
      //       }
      //     } catch (e) {
      //       console.warn(`❌ Connection failed at ${i}`, e);
      //     }
      //   }
      // });

      const nextBtn = await page.$('button[aria-label="Next"]');
      if (!nextBtn) break;

      await Promise.all([nextBtn.click(), page.waitForNavigation({ waitUntil: "domcontentloaded" })]);
      await new Promise((r) => setTimeout(r, 1000));
      currentPage++;
    }
    try {
  
      await axios.post(
        `${process.env.BASE_URL}/api/linkedin/leads`,
        {
        campaign_id: id,
          scraped: leads,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (err) {
      console.log(err);
    }
    await browser.close();
    return res.status(200).json({ status: true, scraped: leads, message: "✅ Scraping and connections done!" });
  } catch (err) {
    console.error("❌ Scraper failed:", err.message);
    if (browser) await browser.close();
    return res.status(500).send("Error: " + err.message);
  }
};



export const linkedinid = async (req, res) => {
  const { user_token } = req.body; // li_at

  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: BROWSER_WS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
    );

      await page.setViewport({ width: 1280, height: 1020 });
    // Set li_at cookie before loading any LinkedIn page
  await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded' });

    // Inject li_at via JS (not setCookie)
    await page.evaluate((token) => {
      document.cookie = `li_at=${token}; domain=.linkedin.com; path=/; secure; SameSite=Lax`;
    }, user_token);

    await page.goto('https://www.linkedin.com/feed', {
      waitUntil: 'domcontentloaded',
    });
      await simulateHumanBehavior(page);

    // Verify login
    if (await page.$('input[name="session_key"]')) {
      throw new Error('Invalid li_at token – login page loaded');
    }

    const profileName = await page.evaluate(() => {
  const el = document.querySelector('h3.profile-card-name.text-heading-large');
  return el ? el.innerText.trim() : null;
});

if (!profileName) throw new Error("Couldn't extract profile name");


    console.log('✅ Logged into LinkedIn successfully');

    // Fetch profile + email from internal API using browser context


    await browser.close();

    return res.status(200).json({
      status: true,
   
         name: profileName,
   
    });
  } catch (err) {
    if (browser) await browser.close();
    console.error('❌ Error:', err.message);
    return res.status(500).json({ status: false, error: err.message });
  }
};












