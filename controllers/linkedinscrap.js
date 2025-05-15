import fs from "fs";
import puppeteer from "puppeteer-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const linkedinscrap = async (req, res) => {
  const { email, password } = req.body;
  const { id } = req.params;
  console.log(`[SCRAPER] Incoming request for ID: ${id}`);

  let leads = [];

  let getdata = await axios.get(
    `https://impactmindz.in/client/scaleleads/api/user/profile/${id}`
  );
  const { data } = getdata;
  let company_size;
  let company;

  if (data.status) {
    company_size = data?.profile[0]?.company_size;
    company = data?.profile[0]?.sector;
    console.log(
      `[SCRAPER] Got company info: size = ${company_size}, sector = ${company}`
    );
  }

  const cookiePath = path.join(__dirname, `cookies_${id}.json`);
  console.log(`[SCRAPER] Cookie path: ${cookiePath}`);

  let browser;

  try {
    console.log(`[SCRAPER] Launching Puppeteer browser...`);
    browser = await puppeteer.launch({
      executablePath:"/usr/bin/google-chrome",
      headless: true,
      slowMo: 50,
      defaultViewport: null,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("baba");
    let allScrapedProfiles = [];
    let currentPage = 1;
    const maxPages = 5; // Change to 10 or 100 based on your need
    const page = await browser.newPage();
    if (fs.existsSync(cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf8"));
      await page.setCookie(...cookies);
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
      });

      console.log("cookie mil gya");
      // Verify if we're logged in
      const loggedIn = await page.$('main[aria-label="Main Feed"]');
      console.log(loggedIn, "bhai hojayega");
      if (!loggedIn)
        throw new Error(
          "Saved cookie is invalid or expired. Please login again."
        );
      console.log("✅ Logged in using saved cookie");
      console.log(`[SCRAPER] ✅ Logged in using saved cookie`);
    } else {
      // No cookies, proceed with login
      console.log("cookie nhimila ");
await page.screenshot({ path: '/tmp/linkedin_login_page.png', fullPage: true });
      console.log("🔐 Logging into LinkedIn with credentials...");
      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 60000, // 60 seconds
      });
      await page.screenshot({ path: '/tmp/linkedin_login_page.png', fullPage: true });
      console.log("✅ Reached LinkedIn login page");

      await page.type("input#username", email, { delay: 100 });
      await page.type("input#password", password, { delay: 100 });

      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "domcontentloaded",timeout: 60000 }),
      ]);

      const loginError = await page.$(".alert-content");
      if (loginError)
        throw new Error("Login failed. Check your LinkedIn credentials.");

      const client = await page.target().createCDPSession();
      const allCookies = (await client.send("Network.getAllCookies")).cookies;

      const liAtCookie = allCookies.find((cookie) => cookie.name === "li_at");
      if (!liAtCookie) throw new Error("li_at cookie not found after login!");

      // Save full cookie
      fs.writeFileSync(cookiePath, JSON.stringify([liAtCookie], null, 2));
      console.log("✅ li_at cookie saved to cookies.json");
      await browser.close();
      return res.status(200).json({
        status: true,
        message:
          "🔒 Login successful & cookie saved. Please run the script again to start scraping.",
      });
    }

    const searchUrl = `https://www.linkedin.com/search/results/people/?companySize=${company_size}&keywords=${encodeURIComponent(
      company
    )}`;
    console.log(`[SCRAPER] Navigating to search URL: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    while (currentPage <= maxPages) {
      console.log(`[SCRAPER] Scraping page ${currentPage}`);

      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      await page.waitForSelector('ul[role="list"] > li', { timeout: 20000 });

      const scrapedProfiles = await page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('ul[role="list"] > li');
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
          const profileLink =
            card.querySelector('a[href*="/in/"]')?.href?.split("?")[0] || "";

          results.push({
            name,
            headline,
            location,
            Education,
            mutualConnections: mutual,
            profileUrl: profileLink,
          });
        });
        return results.slice(0, 25);
      });

      for (const profile of scrapedProfiles) {
        if (
          profile.name &&
          profile.profileUrl &&
          profile.headline &&
          profile.location
        ) {
          leads.push({
            name: profile.name,
            url: profile.profileUrl,
            headline: profile.headline,
            location: profile.location,
            connectedAt: new Date().toISOString(),
            connectionRequest: false, // should be true if you intend to mark them
            firstMessageSent: false,
            replied: false,
          });
        }
      }

      // Send connection requests
      // await page.evaluate(async () => {
      //   const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      //   const connectButtons = [...document.querySelectorAll('button[aria-label*="to connect"]')];
      //   for (let i = 0; i < connectButtons.length; i++) {
      //     try {
      //       connectButtons[i].click();
      //       await delay(1500);
      //       const addNoteBtn = document.querySelector('button[aria-label="Send without a note"]');
      //       if (addNoteBtn) {
      //         addNoteBtn.click();
      //         await delay(1000);
      //       }
      //     } catch (e) {
      //       console.warn(`❌ Failed at index ${i}`, e);
      //     }
      //   }
      // });

      const nextBtn = await page.$('button[aria-label="Next"]');
      if (!nextBtn) break;

      await Promise.all([
        nextBtn.click(),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 3000));
      currentPage++;
    }
    try {
      let token =
        "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2ltcGFjdG1pbmR6LmluL2NsaWVudC9zY2FsZWxlYWRzL2FwaS9sb2dpbiIsImlhdCI6MTc0NzIxOTkwMiwiZXhwIjoxNzQ3MjIxNzAyLCJuYmYiOjE3NDcyMTk5MDIsImp0aSI6ImdUa2NXNWwwQ2xtN09IUVMiLCJzdWIiOiIzMyIsInBydiI6IjIzYmQ1Yzg5NDlmNjAwYWRiMzllNzAxYzQwMDg3MmRiN2E1OTc2ZjciLCJlbWFpbCI6IkRlbHRhQGdtYWlsLmNvbSIsImZvcm1fZmlsbGVkIjp0cnVlfQ.2xtdcHgwu0nEublmR5b99YKbxFuZDtpCWQBNQ_qwnGU";
      await axios.post(
        "https://impactmindz.in/client/scaleleads/api/linkedin/leads",
        {
          campaign_id: null,
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
    return res.status(200).json({
      status: true,
      message: "✅ Scraping and connection requests completed!",
      scraped: leads,
    });
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    if (browser) await browser.close();
    return res.status(500).send("Scraping failed: " + error.message);
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