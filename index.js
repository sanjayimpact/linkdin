import express from 'express';
import puppeteer from 'puppeteer-extra';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import csv from 'csv-parser';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

puppeteer.use(StealthPlugin());
// Upload page

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/scrape', async (req, res) => {
  const { email, password, target } = req.body;

  if (!email || !password || !target) {
    return res.status(400).send('Missing email, password, or target.');
  }
  const cookiePath = path.join(__dirname, 'cookies.json');
  let browser;

  try {
    browser = await puppeteer.launch({
      headless:false,
      slowMo:50,
      defaultViewport: null,
      args: ['--start-maximized'],
    });

    const page = await browser.newPage();
    if (fs.existsSync(cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
      await page.setCookie(...cookies);
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
     
      // Verify if we're logged in
     const loggedIn = await page.$('main[aria-label="Main Feed"]');

      if (!loggedIn) throw new Error('Saved cookie is invalid or expired. Please login again.');
      console.log('✅ Logged in using saved cookie');
    } else {
      // No cookies, proceed with login
      if (!email || !password) {
        return res.status(400).send('Missing email or password.');
      }

      console.log('🔐 Logging into LinkedIn with credentials...');
      await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

      await page.type('#username', email, { delay: 50 });
      await page.type('#password', password, { delay: 50 });

      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      ]);

      const loginError = await page.$('.alert-content');
      if (loginError) throw new Error('Login failed. Check your LinkedIn credentials.');

      const client = await page.target().createCDPSession();
      const allCookies = (await client.send('Network.getAllCookies')).cookies;

      const liAtCookie = allCookies.find(cookie => cookie.name === 'li_at');
      if (!liAtCookie) throw new Error('li_at cookie not found after login!');

      // Save full cookie
      fs.writeFileSync(cookiePath, JSON.stringify([liAtCookie], null, 2));
      console.log('✅ li_at cookie saved to cookies.json');
    }

    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(target)}`;
  
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Scroll slowly to trigger full rendering
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    // Wait for LinkedIn's new structure
    await page.waitForSelector('ul[role="list"] > li', { timeout: 20000 });

const scrapedProfiles = await page.evaluate(() => {
  const results = [];
  const cards = document.querySelectorAll('ul[role="list"] > li');

  cards.forEach(card => {
    const getText = (selector, root = card) =>
      root.querySelector(selector)?.innerText.trim() || '';

   const mb1Divs = card.querySelectorAll('.mb1 > div');
    const count = mb1Divs.length;
const Education = mb1Divs[count - 2]?.innerText?.trim() || ''; // second last
    const location = mb1Divs[count - 1]?.innerText?.trim() || ''; // last

    const name = getText('span[aria-hidden="true"]');

    // Often:
    // 0 → Education / Job Title
    // 1 → Location
 

    // Keep headline as alias of Education/Job Title
    const headline = Education;

    const mutual = getText('.entity-result__insights');

    const profileLink = card.querySelector('a[href*="/in/"]')?.href?.split('?')[0] || '';

    results.push({
      name,
      headline,
      location,
      Education,
      mutualConnections: mutual,
      profileUrl: profileLink
    });
  });

  return results.slice(0, 10);
});
const leads = scrapedProfiles.map(profile => ({
  name: profile.name,
  url: profile.profileUrl,
  connectedAt: null,              // to be filled later
  firstMessageSent: false,
  replied: false
}));

fs.writeFileSync('leads.json', JSON.stringify(leads, null, 2));


    console.log('🤝 Sending connection requests with custom note...');
    await page.evaluate(async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const connectButtons = [...document.querySelectorAll('button[aria-label*="to connect"]')];

      for (let i = 0; i < connectButtons.length; i++) {
        try {
          connectButtons[i].click();
          await delay(1500);

          const addNoteBtn = document.querySelector('button[aria-label="Send without a note"]');
          if (addNoteBtn) {
            addNoteBtn.click();
            await delay(1000);

            // const messageBox = document.querySelector('textarea#custom-message');
            // const sendBtn = document.querySelector('button[aria-label="Send invitation"]');

            // if (messageBox && sendBtn) {
            //   messageBox.value = "👍";
            //   messageBox.dispatchEvent(new Event('input', { bubbles: true }));
            //   await delay(500);
            //   sendBtn.removeAttribute('disabled');
            //   sendBtn.click();
            // }

            // await delay(1500);
          }
        } catch (e) {
          console.warn(`❌ Failed at index ${i}`, e);
        }
      }
    });

    await browser.close();
    return res.render('result', { target, profiles: scrapedProfiles });

   

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    if (browser) await browser.close();
    return res.status(500).send('Scraping failed: ' + error.message);
  }
});

  
  
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
  
  

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
