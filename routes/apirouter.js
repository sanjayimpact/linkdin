import express from 'express';
import { linkedinscrap } from '../controllers/linkedinscrap.js';
export const apiRouter = express.Router();


apiRouter.post("/scrap/:id",linkedinscrap);
