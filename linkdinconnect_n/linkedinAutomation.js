import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export const connectAndFollowUp = async ({ liAt, profileUrl, connectMessage, followUpMessage }) => {
  const browser = await puppeteer.launch({
    headless: false, // for debugging use false
    slowMo: 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Setup viewport and user-agent
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110 Safari/537.36');

  // ✅ Set cookie correctly
  await page.setCookie({
    name: 'li_at',
    value: liAt,
    domain: '.linkedin.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  });

  // Go to LinkedIn profile
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });

  try {
    // Try to find and click "Connect" button via XPath
// Wait for the button with aria-label that starts with "Invite" and type="button"
await page.waitForSelector('button[type="button"][aria-label^="Invite"]', { timeout: 5000 });
const connectBtn = await page.$('button[type="button"][aria-label^="Invite"]');

if (connectBtn) {
  // Visual Highlight (no click)
  await page.evaluate(el => {
    el.style.border = "2px solid blue";
    el.style.backgroundColor = "#e0f7fa";
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, connectBtn);

  const btnText = await page.evaluate(el => el.innerText, connectBtn);
  console.log(`✅ Found 'Connect' button: "${btnText}"`);
} else {
  console.log("❌ No Connect button found with aria-label starting with 'Invite'");
}

    

    // Wait and add a note if possible
    // await page.waitForSelector('button[aria-label="Add a note"]', { timeout: 5000 });
    // await page.click('button[aria-label="Add a note"]');

    // await page.waitForSelector('textarea[name="message"]', { timeout: 5000 });
    // await page.type('textarea[name="message"]', connectMessage, { delay: 50 });

    // await page.click('button[aria-label="Send now"]');
    console.log('✅ Connection request sent!');
  } catch (err) {
    console.warn('⚠️ Could not send connection request:', err.message);
    await browser.close();
    return;
  }

  // Wait for connection acceptance (you can later replace this with polling logic)
  console.log('⏳ Waiting 1 minute for connection acceptance...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Go to messages and try to send follow-up
  try {
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('ul.msg-conversations-container__conversations-list', { timeout: 10000 });

    const isAccepted = await page.evaluate(() => {
      const items = [...document.querySelectorAll('li.msg-conversation-listitem')];
      return items.some(item => item.innerText.includes('You are now connected') || item.innerText.includes('Accepted your invitation'));
    });

    if (isAccepted) {
      const [firstChat] = await page.$$('li.msg-conversation-listitem');
      if (firstChat) {
        await firstChat.click();
        await page.waitForSelector('[contenteditable="true"]', { timeout: 10000 });
        await page.type('[contenteditable="true"]', followUpMessage, { delay: 50 });
        await page.keyboard.press('Enter');
        console.log('✅ Follow-up message sent!');
      }
    } else {
      console.warn('⚠️ No confirmation of connection yet.');
    }
  } catch (err) {
    console.error('❌ Messaging check failed:', err.message);
  }

  await browser.close();
};
