import axios from 'axios';
import { sendEmail } from '../utils/Email/emailService.js';
import nodemailer from 'nodemailer';
import { followupHtml } from '../utils/EmailTemplates/followupEmail.js';
import Imap from 'imap';
import {simpleParser} from "mailparser"
const API_KEY = process.env.API_KEY ||'RCteoxSZ4-myK2B-qu1aWg'; // Use .env in production

 
export const scrapemail = async (req, res) => {
  const{ body} = req.body;
  const {  sector, company_size, id } = body;
 const myCookie = req.cookies; // Access cookie here
let gtoken = myCookie.gmail_access_token;
let mstoken = myCookie.microsoft_access_token;
let user = myCookie.uemail
let pass = myCookie.uapppas
let  msgHeaderId;
const token = req.token;

  try {
    // 1. Search for people
    const response = await axios.post(
      'https://api.apollo.io/api/v1/mixed_people/search',
      {
        page:1,
        per_page:1,
        person_titles: [sector],
       
        organization_num_employees_ranges:[company_size]
      },
      {
        headers: {
          'x-api-key': API_KEY,

          'Cache-Control': 'no-cache',
         
      'Content-Type': 'application/json',
  
    
        },
      }
    );

    const people = response.data.people || [];
    if (people.length === 0) {
      return res.status(404).json({ message: 'No contacts found' });
    }

    // 2. Fetch detailed info from `/people/match`
    const detailedContacts = await Promise.all(
      people.map(async (person) => {
        try {
          const detailRes = await axios.get(
            `https://api.apollo.io/api/v1/people/match?id=${person.id}`,
            {
              headers: {
                'x-api-key': API_KEY,
              },
            }
          );

          const profile = detailRes.data.person || {};
          return {
            id: person.id,
            name: `${person.first_name} ${person.last_name}`,
            email: profile.email || 'No email found',
            title: profile.title || person.title || '',
            company: profile.organization?.name || person.organization?.name || '',
            linkedin: profile.linkedin_url || person.linkedin_url || '',
            city: profile?.city || person?.city || '',
            state: profile?.state || person?.state || '',
            country: profile?.country || person?.country || '',
          };
        } catch (err) {
          console.warn(`⚠️ Failed to fetch match for ID ${person.id}:`, err.message);
          return null;
        }
      })
    );

    const validResults = detailedContacts.filter(Boolean);
    // let msgHeaderId =await sendViaGmail(gtoken, lead.email);
    
    const campaignId = id;
    const leadsWithMsgId = [];
const checkRes = await axios.get(`${process.env.BASE_URL}/api/email-leads/`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
const{data} = checkRes;


// Step 2: Build a Set of all existing UIDs
const existingUids = new Set(data.data.map(item => item.uid));
    for (const lead of validResults) {

        if (existingUids.has(lead.id)) {
    console.log(`⏩ Skipping ${lead.email}, already exists in DB.`);
    continue;
  }
  try {
    if(gtoken){
      msgHeaderId = await sendViaGmail(gtoken, "borasanju84@gmail.com");

    }
    if(user && pass){
      msgHeaderId = await sendemailSMTP(user,pass);
      console.log(msgHeaderId);
    }

    leadsWithMsgId.push({
      uid: lead.id,
      name: lead.name,
      email: lead.email,
      title: lead.title,
      company: lead.company,
      linkedin: lead.linkedin,
      State: lead.state,
      city: lead.city,
      country: lead.country,
      emailsend:true,
      replied: false,
      msgid: msgHeaderId ||"89978"
    });
  } catch (err) {
    console.error(`❌ Failed to send Gmail to ${lead.email}:`, err.message);
  }
}



// const saveRes = await axios.post(
//   `${process.env.BASE_URL}/api/email-leads`,
//   {
//     campaign_id: campaignId,
//     leads: leadsWithMsgId
//   },
//   {
//     headers: {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json',
//     },
//   }
// );


//get token to automation 
   if('microsoft_access_token' in myCookie){
    let mstoken = myCookie.microsoft_access_token;
   
     for (const lead of validResults) {
    
    try {
     let msgid =  await sendViaMicrosoft(mstoken, "sanjay.impactmindz@gmail.com");
     console.log(msgid,'id message');
      console.log(`✅ Email sent to ${lead.email}`);
    } catch (err) {
      console.error(`❌ Failed to send email to ${lead.email}:`, err.message);
    }
  }
   
   }    

    

   
  

    return res.status(200).json({message:"successfully stored", contacts: validResults });

  } catch (error) {
    console.error('❌ Error fetching contacts:', error.response?.data || error.message);
    return res.status(500).json({
      message: 'Failed to fetch contacts',
      error: error.response?.data || error.message,
    });
  } 
};

// helper functions


const sendViaGmail = async (token, toEmail) => {
  const message = [
    `To: ${toEmail}`,
    "Subject: Gmail API Test",
    "",
    "This is a test email ."
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

 const response =  await axios.post(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    { raw: encodedMessage },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  let msgid =response.data.id;
    const detailRes = await axios.get(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgid}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        format: "metadata",
        metadataHeaders: ["Message-ID"],
      },
    }
  );

  const headers = detailRes.data.payload.headers;

  const messageIdHeader = headers.find(h => h.name === "Message-Id")?.value;
 console.log(messageIdHeader);
 return messageIdHeader;
};

const sendViaMicrosoft = async (token, toEmail) => {

  try {
    // Step 1: Create draft
    const draftRes = await axios.post(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        subject: "Outlook Test",
        body: {
          contentType: "Text",
          content: "This is a test email 👍",
        },
        toRecipients: [{ emailAddress: { address: toEmail } }],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const messageId = draftRes.data.internetMessageId; // ✅ This is the ID you can track later


    // Step 2: Send the message
    await axios.post(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/send`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Email sent successfully");
    return messageId;

  } catch (error) {
    console.error("❌ Microsoft email send failed:", error.response?.data || error.message);
    return null;
  }
};


export const sendemailSMTP = async (user, pass) => {

  if(!user || !pass){
    return;
  }

const messageId = `<${Date.now()}-${Math.random()}@gmail.com>`;
  
  try{
  const transporterInstance = nodemailer.createTransport({
  host: "smtp.gmail.com", // Correct SMTP server
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: user,
    pass: pass,
  },
}); 

transporterInstance.verify((error, success) => {
  if (error) {
    console.error("SMTP verification failed:", error);
    
  } else {
    console.log("SMTP credentials are valid!");

  }
});

 const sendmail = await sendEmail(
  transporterInstance,
        user,
        "borasanju84@gmail.com",
        "Boost Your Website Conversions 🚀",
        followupHtml("Boost Your Website Conversions 🚀", "We noticed you might benefit from high-converting landing pages and automated funnels. Our team specializes in helping businesses like yours increase leads and sales.",
  "Schedule a Free Call"),

      );
      let messageId = sendmail?.messageId;
  return messageId;
  }catch(err){
    console.log(err);
  }
 
}

export const checkSMTPCredentials = async(req,res)=>{
  const{user,pass} = req.body;

 
 if(!user || !pass){
    return res.json({message:"Email and app Password are required",isSuccess:false});
  }

  
  try{
  const transporterInstance = nodemailer.createTransport({
  host: "smtp.gmail.com", // Correct SMTP server
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: user,
    pass: pass,
  },
}); 

transporterInstance.verify((error, success) => {
  if (error) {
    console.error("SMTP verification failed:", error);
    return res.json({message:"SMTP Verification Failed",isSuccess:false});
    
  } else {
    console.log("SMTP credentials are valid!");
    return res.json({message:"Successfully Login ",isSuccess:true})

  }
});
  }catch(err){
    return res.json(500).json({message:err.message})
  }
}





//done 
export const checkemailreplied = async (token,messageId) => {


  try {
    // Step 1: List inbox messages from last 3 days
    const listRes = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        
        maxResults: 2,
      },
    });

    const messages = listRes.data.messages || [];

    

    // Step 2: Check each message for In-Reply-To
    for (const msg of messages) {

      const detailRes = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          format: 'metadata',
          metadataHeaders: ['In-Reply-To', 'References'],
        },
      });
   

      const headers = detailRes.data.payload.headers;
      const inReplyTo = headers.find(h => h.name == 'In-Reply-To')?.value;
      const references = headers.find(h => h.name =='References')?.value;

      if (inReplyTo == messageId || (references && references.includes(messageId))) {
        console.log(`✅ Reply found to message ID: ${messageId}`);
        return res.status(200).json({ replied: true, message: 'Reply found' });
      }
    }

    console.log(`❌ No reply found to message ID: ${messageId}`);
    return res.status(200).json({ replied: false, message: 'No reply yet' });

  } catch (err) {
    console.error('❌ Error checking Gmail replies:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to check email replies' });
  }
};







export const checkoutlookreplied = async (token,messageId) => {
 
  if (!token || !messageId) {
    return res.status(400).json({ error: 'Missing token or messageId' });
  }

  try {
const inboxMessages = await axios.get(
  `https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages`,
  {
    headers: { Authorization: `Bearer ${token}` }
  }
);
      console.log(inboxMessages.data.value);
    const messages = inboxMessages.data.value || [];

    for (const msg of messages) {
      const msgDetail = await axios.get(
        `https://graph.microsoft.com/v1.0/me/messages/${msg.id}?$select=internetMessageHeaders,subject`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
  console.log(msgDetail.data);
      const headers = msgDetail.data.internetMessageHeaders || [];
      const inReplyTo = headers.find(h => h.name.toLowerCase() === 'in-reply-to')?.value;
      const references = headers.find(h => h.name.toLowerCase() === 'references')?.value;

      if (inReplyTo === messageId || (references && references.includes(messageId))) {
        console.log(`✅ Reply found to message: ${msgDetail.data.subject}`);
        return res.status(200).json({ replied: true, subject: msgDetail.data.subject });
      }
    }

    return res.status(200).json({ replied: false });

  } catch (err) {
    console.error('❌ Error checking Outlook replies:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to check replies' });
  }
};





export const checksmtpreplied = async (user,pass,targetMessageId) => {


  if (!targetMessageId) {
    return res.status(400).json({ error: 'Missing message_id in request' });
  }

 

  const imap = new Imap({
    user: user,
    password: pass, // App Password (use .env in production)
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  const checkReply = () => new Promise((resolve, reject) => {
    let foundReply = false;
    let scannedCount = 0;
    const parsePromises = []; // ✅ Track parsing promises

    imap.once('ready', () => {
      console.log('📡 IMAP connection ready');

      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.error('❌ Failed to open inbox:', err);
          return reject(err);
        }

        console.log('📬 INBOX opened. Total messages:', box.messages.total);

        // Fetch all messages
        const f = imap.seq.fetch('1:*', {
          bodies: ['HEADER.FIELDS (IN-REPLY-TO REFERENCES SUBJECT FROM DATE)'],
        });

        f.on('message', (msg, seqno) => {
          msg.on('body', (stream) => {
            const parserPromise = new Promise((resolveParser) => {
              simpleParser(stream, (err, parsed) => {
                if (err) {
                  console.error(`❌ Error parsing message #${seqno}:`, err.message);
                  return resolveParser(); // Don't block other messages
                }

                scannedCount++;
           
                const inReplyTo = parsed.headers.get('in-reply-to');
                const references = parsed.headers.get('references');
                const subject = parsed.subject;

                
            

                if (inReplyTo?.trim() == targetMessageId.trim()) {
                  foundReply = true;
                }

                resolveParser();
              });
            });

            parsePromises.push(parserPromise);
          });
        });

        f.once('error', (err) => {
          console.error('❌ Fetch error:', err);
          reject(err);
        });

        f.once('end', async () => {
          await Promise.all(parsePromises); // ✅ Wait for all parser callbacks
          imap.end();
          resolve(foundReply);
        });
      });
    });

    imap.once('error', (err) => {
      console.error('❌ IMAP connection error:', err);
      reject(err);
    });

    imap.once('end', () => {
      console.log('📴 IMAP connection closed');
    });

    imap.connect(); // 🔌 Connect to IMAP server
  });

  try {
    const replied = await checkReply();
   
    if (replied) {
      return res.status(200).json({ replied: true, message: '✅ Reply found!' });
    } else {
      return res.status(200).json({ replied: false, message: '❌ No reply yet.' });
    }
  } catch (error) {
    console.error('❌ IMAP Error:', error);
    return res.status(500).json({ error: 'Failed to check replies' });
  }
};



//configure the refresh token 


























export const sendemail = async(req,res)=>{
  const{token,provider} = req.body;

   let recipientEmail = "sanjubora84@gmail.com"
  try{
     if(provider==="google"){
       let send = await axios.post()
      await sendViaGmail(token,recipientEmail)
     }
     if(provider ==="microsoft"){
      recipientEmail = "sanjay.impactmindz@gmail.com"
      // await sendViaMicrosoft(token,recipientEmail)
     }
     res.json({ success: true, message: "Emails sent successfully" });
  }catch(err){
    console.log(err);
  }

}

export const checkAllReplies = async (req, res) => {
  const leadsToCheck = await axios.get(`${process.env.BASE_URL}/api/email-leads?replied=false`);

  for (const lead of leadsToCheck.data.data) {
    let isReplied = false;

    try {
      if (lead.source === 'gmail') {
        isReplied = await checkemailreplied(lead.token, lead.msgid);
      } else if (lead.source === 'outlook') {
        isReplied = await checkoutlookreplied(lead.token, lead.msgid);
      } else if (lead.source === 'smtp') {
        isReplied = await checksmtpreplied(lead.email, lead.password, lead.msgid);
      }

      if (isReplied) {
        await axios.patch(`${process.env.BASE_URL}/api/email-leads/${lead.uid}`, {
          replied: true,
        });
        console.log(`✅ Updated: ${lead.email}`);
      }

    } catch (err) {
      console.error(`❌ Error checking reply for ${lead.email}:`, err.message);
    }
  }

  return res.status(200).json({ message: 'Reply check complete' });
};

export const testing = async(req,res)=>{
  try{
       console.log("run every 2 minutes later")
  }catch(err){
    console.log(err)
  }
}