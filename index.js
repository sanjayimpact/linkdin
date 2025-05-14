import express from 'express';
import puppeteer from 'puppeteer-extra';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { apiRouter } from './routes/apirouter.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));



puppeteer.use(StealthPlugin());


app.use('/api',apiRouter)

  
  
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
