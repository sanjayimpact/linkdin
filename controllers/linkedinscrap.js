
import fs from 'fs';
import puppeteer from 'puppeteer-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios'
const __dirname = path.dirname(fileURLToPath(import.meta.url));


export const linkedinscrap = async(req,res)=>{

  const{id} = req.params;
let leads = [];
  
  let getdata = await axios.get(`https://impactmindz.in/client/scaleleads/api/user/profile/${id}`);
 const {data} = getdata;
 let company_size;
 let company;


  if(data.status){
     company_size = data?.profile?.company_size;
     company = data?.profile?.sector;

  }




  const cookiePath = path.join(__dirname, 'cookies.json');
  console.log(cookiePath);
  let browser;

  try {
    browser = await puppeteer.launch({
      headless:true,
      slowMo:50,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
 let allScrapedProfiles = [];
let currentPage = 1;
const maxPages = 5; // Change to 10 or 100 based on your need
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


      console.log('🔐 Logging into LinkedIn with credentials...');
      await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

    

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
      await browser.close();
      return res.status(200).json({
        status: true,
        message: '🔒 Login successful & cookie saved. Please run the script again to start scraping.'
      });
    }

    const searchUrl = `https://www.linkedin.com/search/results/people/?companySize=${company_size}&keywords=${encodeURIComponent(company)}`;
  
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

 while (currentPage <= maxPages) {
  console.log("inside while")
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(resolve => setTimeout(resolve, 2500));
      }

      await page.waitForSelector('ul[role="list"] > li', { timeout: 20000 });

      const scrapedProfiles = await page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('ul[role="list"] > li');
        cards.forEach(card => {
          const getText = (selector, root = card) => root.querySelector(selector)?.innerText.trim() || '';
          const mb1Divs = card.querySelectorAll('.mb1 > div');
          const count = mb1Divs.length;
          const Education = mb1Divs[count - 2]?.innerText?.trim() || '';
          const location = mb1Divs[count - 1]?.innerText?.trim() || '';
          const name = getText('span[aria-hidden="true"]');
          const headline = Education;
          const mutual = getText('.entity-result__insights');
          const profileLink = card.querySelector('a[href*="/in/"]')?.href?.split('?')[0] || '';

          results.push({ name, headline, location, Education, mutualConnections: mutual, profileUrl: profileLink });
        });
        return results.slice(0, 25);
      });
 
      for (const profile of scrapedProfiles) {
        leads.push({
          name: profile.name,
          url: profile.profileUrl,
          headline: profile.headline,
          location: profile.location,

          connectedAt: new Date().toISOString(),
          firstMessageSent: false,
          replied: false
        });
      }

      fs.writeFileSync('leads.json', JSON.stringify(leads, null, 2));
      console.log("enter lead length")
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
        page.waitForNavigation({ waitUntil: 'domcontentloaded' })
      ]);

      await new Promise(resolve => setTimeout(resolve, 3000));
      currentPage++;
    }


    await browser.close();
     return res.status(200).json({
      status: true,
      message: '✅ Scraping and connection requests completed!',
      scraped: leads
    });
    
   

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    if (browser) await browser.close();
    return res.status(500).send('Scraping failed: ' + error.message);
  }
}