import fs from "fs";
import puppeteer from "puppeteer-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config'
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
puppeteer.use(StealthPlugin());

const BROWSER_WS = process.env.SCRAPER_URL;

function simulateMouseMove(page) {
  return page.mouse.move(
    Math.floor(Math.random() * 1000),
    Math.floor(Math.random() * 600),
    { steps: 5 + Math.floor(Math.random() * 10) }
  );
}


export const linkedinscrap = async (req, res) => {
  const { id } = req.params;
  const{sub} = req.user;
  const token = req.token;


  // 1. 🔐 Fetch li_at token from your backend API
  let li_at_token = "";
  try {
    const tokenRes = await axios.get(`${process.env.BASE_URL}/api/linkedin-token/${sub}`,{
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
    const {data} = tokenRes;
    
  
    li_at_token = data?.data?.linkedin_token;

    if (!li_at_token) throw new Error("Missing li_at token");
  } catch (err) {
    console.error("❌ Failed to fetch li_at token:", err.message);
    return res.status(500).send("Failed to fetch LinkedIn cookie");
  }

  // 2. 🔍 Fetch additional company info
  let leads = [];
  let company_size = "";
  let company = "";
  try {
    const profileRes = await axios.get(`${process.env.BASE_URL}/api/user/profile/${sub}`,{
      headers:{
        Authorization: `Bearer ${token}`,
      }
    });
const {data} = profileRes;


    const profile = data?.profile?.[0];


    company_size = profile?.company_size;
    company = profile?.sector;
  } catch (err) {
    console.warn("⚠️ Failed to fetch profile info:", err.message);
  }

  let browser;
  try {
    // browser = await puppeteer.connect({
    //   browserWSEndpoint: BROWSER_WS
    
    // });
    browser = await puppeteer.launch({
      headless:false
    
    });


    const page = await browser.newPage();

await page.goto("https://www.linkedin.com/feed");
console.log(li_at_token);
await page.evaluate((liAt) => {
  document.cookie = `li_at=${liAt}; domain=.linkedin.com; path=/; secure; SameSite=None`;
}, li_at_token);

await page.evaluate(() => location.href = "https://www.linkedin.com/feed");
await page.waitForNavigation({ waitUntil: "domcontentloaded" });

    // 4. 🔗 Open LinkedIn and validate login

    if (await page.$("input[name=session_key]")) {
      throw new Error("Invalid li_at token. Login page loaded.");
    }
    console.log("✅ Logged in successfully using li_at cookie");

await new Promise(r => setTimeout(r, 500));
    // 5. 🔎 Go to search results
    const searchUrl = `https://www.linkedin.com/search/results/people/?companySize=${company_size}&keywords=${encodeURIComponent(company)}`;
   await page.evaluate(url => window.location.href = url, searchUrl);
await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    let currentPage = 1;
    const maxPages = 2;

    while (currentPage <= maxPages) {

      for (let i = 0; i <=2; i++) {
         await simulateMouseMove(page);
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise((r) => setTimeout(r, 500));
      }

      await page.waitForSelector('ul[role="list"] > li', { timeout: 2000 });

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
          });
        }
      });

      // 🚀 Try to connect with people
      await page.evaluate(async () => {
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        const buttons = [...document.querySelectorAll('button[aria-label*="to connect"]')];
        for (let i = 0; i < buttons.length; i++) {
          try {
            buttons[i].click();
            await delay(500);
            const sendBtn = document.querySelector('button[aria-label="Send without a note"]');
            if (sendBtn) {
              sendBtn.click();
              await delay(500);
            }
          } catch (e) {
            console.warn(`❌ Connection failed at ${i}`, e);
          }
        }
      });

      const nextBtn = await page.$('button[aria-label="Next"]');
      if (!nextBtn) break;

      await Promise.all([nextBtn.click(), page.waitForNavigation({ waitUntil: "domcontentloaded" })]);
      await new Promise((r) => setTimeout(r, 500));
      currentPage++;
    }
    try {
  
      await axios.post(
        `${process.env.BASE_URL}/api/linkedin/leads`,
        {
        campaign_id: 11,
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














export const scrapfromcsv = async(req,res)=>{
  //   app.post('/scrape-from-csv', upload.single('csvFile'), async (req, res) => {
//     const { email, password } = req.body;
//     const filePath = req.file.path;
  
//     const profileUrls = [];
  
//     // Parse CSV to extract URLs
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on('data', (row) => {
//         const url = Object.values(row)[0]; // assuming first column
//         if (url.includes('linkedin.com/in')) {
//           profileUrls.push(url.trim());
//         }
//       })
//       .on('end', async () => {
//         const scrapedResults = [];
  
//         const browser = await puppeteer.launch({
//           headless: true,
//           slowMo: 50,
//           defaultViewport: null
//         });
//         const page = await browser.newPage();
  
//         try {
//           console.log("Logging in to LinkedIn...");
//           await page.goto('https://www.linkedin.com/login');
//           await page.type('#username', email);
//           await page.type('#password', password);
//           await page.click('button[type="submit"]');
//           await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  
//           for (const profileUrl of profileUrls) {
//             console.log(`Scraping: ${profileUrl}`);
//             try {
//               await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
  
//               const profileData = await page.evaluate(() => {
//                 const getText = (selector) => document.querySelector(selector)?.innerText.trim() || '';
//                 return {
//                   name: getText('.v-align-middle.break-words'),
//                   headline: getText('.text-body-medium.break-words'),
//                   location: getText('.text-body-small.inline.t-black--light.break-words'),
//                   jobTitle: getText('.text-body-medium.break-words')
//                 };
//               });
  
//               // Recent activity
//               const activityUrl = profileUrl.endsWith('/')
//                 ? profileUrl + 'recent-activity/'
//                 : profileUrl + '/recent-activity/';
//               await page.goto(activityUrl, { waitUntil: 'domcontentloaded' });
  
//               const recentPosts = await page.evaluate(() => {
//                 const posts = [];
//                 const elements = document.querySelectorAll('.update-components-text');
//                 elements.forEach((el, i) => {
//                   if (i < 2) posts.push(el.innerText.trim());
//                 });
//                 return posts;
//               });
  
//               profileData.recentPosts = recentPosts;
//               profileData.generatedMessage = `Hi ${profileData.name}, I saw your profile as a ${profileData.jobTitle}. Your recent post "${recentPosts[0] || '...'}" really stood out. I’d love to connect!`;
  
//               scrapedResults.push({ url: profileUrl, ...profileData });
//             } catch (innerErr) {
//               console.error(`Failed to scrape ${profileUrl}:`, innerErr.message);
//               scrapedResults.push({ url: profileUrl, error: innerErr.message });
//             }
//           }
  
//           await browser.close();
//           fs.unlinkSync(filePath); // Clean up uploaded CSV
//           res.render('batch-result', { results: scrapedResults });
//         } catch (loginError) {
//           await browser.close();
//           res.status(500).send('Login or scraping failed: ' + loginError.message);
//         }
//       });
//   });
  
  
}