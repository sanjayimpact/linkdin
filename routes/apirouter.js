import express from 'express';
import { linkedinscrap } from '../controllers/linkedinscrap.js';
import { loginlinkedin } from '../controllers/loginfirst.js';
export const apiRouter = express.Router();


apiRouter.post("/scrap/:id",linkedinscrap)
.post("/login",loginlinkedin)
