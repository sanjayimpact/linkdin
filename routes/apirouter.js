import express from 'express';
import { linkedinscrap } from '../controllers/linkedinscrap.js';
import { loginlinkedin } from '../controllers/loginfirst.js';
import { authmiddleware } from '../middlewares/jwtauth.js';
import { runjob } from '../controllers/automation.js';
import { scrapemail, sendemail, sendemailSMTP } from '../controllers/emailscrap.js';
export const apiRouter = express.Router();


apiRouter.post("/scrap/:id",authmiddleware,linkedinscrap)
.post("/startjob",authmiddleware,runjob)
.post("/login",loginlinkedin)
.post("/scrapemail",scrapemail)
.post('/sendemail',authmiddleware,sendemail)
.post('/sendemailsmtp',sendemailSMTP)
