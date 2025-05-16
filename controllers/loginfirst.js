import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
puppeteer.use(StealthPlugin());


export const loginlinkedin = async()=>{
try{
 const browser = await puppeteer.launch({
    headless: false, // ⬅️ Visible browser
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

  console.log("🔐 Please log in manually in the browser...");

  // Wait for successful login (when feed is visible)
  await page.waitForSelector('main[aria-label="Main Feed"]', { timeout: 0 });
  console.log("✅ Logged in! Extracting cookie...");

  const client = await page.target().createCDPSession();
  const allCookies = (await client.send("Network.getAllCookies")).cookies;
  const liAt = allCookies.find(c => c.name === "li_at");

  if (!liAt) {
    console.error("❌ li_at cookie not found.");
    return;
  }

  fs.writeFileSync("cookies_liat.json", JSON.stringify([liAt], null, 2));
  console.log("✅ li_at cookie saved to cookies_liat.json");

  await browser.close();
}catch(err){
    console.log(err)
}
}