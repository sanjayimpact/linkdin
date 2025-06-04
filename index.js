import express from 'express';
import puppeteer from 'puppeteer-extra';
import bodyParser from 'body-parser';
import path from 'path';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { apiRouter } from './routes/apirouter.js';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import axios from 'axios';
import qs from 'qs'
dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({
    origin: 'http://localhost:3000',
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

puppeteer.use(StealthPlugin());


app.use('/api',apiRouter)
// const CLIENT_ID = '860960710597-9km11ujak39pud8klu5c1d3fedvllfhr.apps.googleusercontent.com';
// const CLIENT_SECRET = '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';
// const REDIRECT_URI = 'http://localhost:4000/oauth2callback';

// const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.modify','https://www.googleapis.com/auth/gmail.metadata','https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/userinfo.email'];

// app.get('/login', (req, res) => {
//   const oauthURL = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify({
//     client_id: CLIENT_ID,
//     redirect_uri: REDIRECT_URI,
//     response_type: 'code',
//     scope: SCOPES.join(' '),
//     access_type: 'offline',
//     prompt: 'consent',
//   })}`;

//   return res.json({url:oauthURL,isSuccess:true})
// });

// app.get('/oauth2callback', async (req, res) => {
//   const { code } = req.query;

//   try {
//     const { data } = await axios.post('https://oauth2.googleapis.com/token', qs.stringify({
//       code,
//       client_id: CLIENT_ID,
//       client_secret: CLIENT_SECRET,
//       redirect_uri: REDIRECT_URI,
//       grant_type: 'authorization_code',
//     }), {
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     });
// const{access_token,refresh_token,expires_in} = data;

//     // ✅ You'll get both access_token and refresh_token
//     console.log('Access Token:', data.access_token);
//     console.log('Refresh Token:', data.refresh_token);
//     const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
//       headers: {
//         Authorization: `Bearer ${data?.access_token}`,
//       },
//     });
    
//     const email = userInfoRes.data.email;


// const redirectURL = `http://localhost:3000/dashboard?` + qs.stringify({
//       email,
//       access_token,
//       refresh_token,
//       expires_in,
//     });

//     // ✅ Proper redirect
//     return res.redirect(redirectURL);
//   } catch (error) {
//     console.error('Token Exchange Failed:', error.response?.data || error.message);
//     res.send('Error exchanging token.');
//   }
// });

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
