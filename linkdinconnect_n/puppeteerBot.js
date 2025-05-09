import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

export const getLiAt = async (email, password) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110 Safari/537.36'
    );

    console.log("Navigating to LinkedIn login page...");
    await page.goto('https://www.linkedin.com/login',{waitUntil: 'networkidle2'});

    await page.waitForSelector('#username', { timeout: 5000 });
    await page.type('#username', email, { delay: 100 });

    await page.waitForSelector('#password', { timeout: 5000 });
    await page.type('#password', password, { delay: 100 });

    await page.waitForSelector('button[type=submit]', { timeout: 5000 });
    await page.click('button[type=submit]');

    await page.screenshot({ path: 'after-login.png' });

    // Wait for homepage element to ensure full login (not just navigation)
    try {
      await page.waitForSelector('[data-test-global-nav-link="feed"]', { timeout: 20000 });
    } catch {
      console.warn("Homepage element not found, proceeding to cookie extraction anyway...");
    }

    // Use CDP to get all cookies
    const client = await page.target().createCDPSession();
    const allCookies = (await client.send('Network.getAllCookies')).cookies;
 
    // Optional: Save all cookies to file for debugging

    // Find the li_at cookie
    const liAt = allCookies.find(cookie => cookie.name === 'li_at')?.value;

    await browser.close();

    if (!liAt) {
      throw new Error('li_at cookie not found');
    }
    
    return liAt;

  } catch (error) {
    console.error("Login failed:", error.message);
    if (browser) await browser.close();
    throw new Error('Failed to log in or extract li_at cookie');
  }
};
