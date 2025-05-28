import axios from 'axios';
import { sendEmail } from '../utils/Email/emailService.js';
import nodemailer from 'nodemailer';
import { followupHtml } from '../utils/EmailTemplates/followupEmail.js';
const API_KEY = 'jQdIHfpTFBK66EVU6qeZjw'; // Use .env in production

export const scrapemail = async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.apollo.io/api/v1/mixed_people/search',
      {
        // 🔽 Request Body (not params)
        page: 1,
        per_page: 10,
        person_titles: ['teacher'],
        person_locations: ['California, US'],
      },
      {
        // 🔽 Headers
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );

    const contacts = response.data.people || [];

    if (contacts.length === 0) {
      return res.status(404).json({ message: 'No contacts found' });
    }

    const result = contacts.map((person) => ({
      name: `${person.first_name} ${person.last_name}`,
      email: person.email || 'No email available',
      title: person.title || '',
      company: person.organization?.name || '',
    }));

    return res.status(200).json({ contacts: result });

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
    "This is a test email sent from Gmail API via Firebase accessToken."
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  await axios.post(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    { raw: encodedMessage },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};
//helper function
const sendViaMicrosoft = async (token, toEmail) => {
  await axios.post(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    {
      message: {
        subject: "Outlook Test",
        body: {
          contentType: "Text",
          content: "This is a test email from Outlook using Microsoft Graph API.",
        },
        toRecipients: [{ emailAddress: { address: toEmail } }],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
};


export const sendemail = async(req,res)=>{
  const{token,provider} = req.body;

   let recipientEmail = "sanjubora84@gmail.com"
  try{
     if(provider==="google"){
       let send = await axios.post()
      // await sendViaGmail(token,recipientEmail)
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



// send email via simple SMTP server;
  // sendEmail(
  //       email,
  //       "Your Experience created Successfully",
  //       ExpCreatedSuccessEmail(userName, newExperience)
  //     );
export const sendemailSMTP = async (req, res) => {
 let{user,pass}  = req.body;
  if(!user || !pass){
    return res.status(400).json({message:"Please provide user and pass"});
  }
 user = user.replace(/\s+/g, "");
pass = pass.replace(/\s+/g, "");

  
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
    return res.status(401).json({ message: "SMTP Login Failed", error });
  } else {
    console.log("SMTP credentials are valid!");
    return res.json({ message: "SMTP Login Success ✅" });
  }
});

 await sendEmail(
  transporterInstance,
        user,
        "sanjubora84@gmail.com",
        "Boost Your Website Conversions 🚀",
        followupHtml("Boost Your Website Conversions 🚀", "We noticed you might benefit from high-converting landing pages and automated funnels. Our team specializes in helping businesses like yours increase leads and sales.",
  "Schedule a Free Call")
      );
  }catch(err){
    console.log(err);
  }
 
}
