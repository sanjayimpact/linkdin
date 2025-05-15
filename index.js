import express from 'express';
import puppeteer from 'puppeteer-extra';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { run } from './controllers/automation.js';

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

  
  


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
