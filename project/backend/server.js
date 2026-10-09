import express from 'express';
import cors from 'cors';
import consultationRouter from './routes/consultation.js';
import prescriptionRouter from './routes/prescription.js';
import summariesRouter from './routes/summaries.js';
import sessionsRouter from './routes/sessions.js';
import abhaRouter from './routes/abha.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/consultation', consultationRouter);
app.use('/api/prescription', prescriptionRouter);
app.use('/api/summaries', summariesRouter);
app.use('/v1/sessions', sessionsRouter);
app.use('/api/abha', abhaRouter);

export default app;
