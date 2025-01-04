import { configDotenv } from 'dotenv';
configDotenv();
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import bodyParser from 'body-parser'; // Importing body-parser
import userRoutes from './routes/user.routes.js'; 
import courseRoutes from './routes/course.routes.js'; 
import paymentRoutes from './routes/payment.routes.js';
import categories from './routes/category.routes.js';
import miscellaneousRoutes from './routes/miscellaneous.routes.js';
import express from 'express';
import connectToDb from './config/db.config.js';
import errorMiddleware from './middleware/error.middleware.js';

const app = express();

// middleware
app.use(express.json({ limit: '500mb' }));  // JSON size limit (if you're sending JSON data too)
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(cors({
    origin: 'http://localhost:5173', // Replace with your frontend URL
    credentials: true, // Allow cookies and credentials
}));

// Body parser setup if using body-parser package
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use((req, res, next) => {
    req.setTimeout(300000); // 300 seconds (5 minutes)
    res.setTimeout(300000); // 300 seconds (5 minutes)
    next();
});

app.use('/api/v1/user', userRoutes); 
app.use('/api/v1/courses', courseRoutes); 
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/', miscellaneousRoutes);
app.use('/api/v1/category', categories); 

app.all('*', (req, res) => {
    res.status(404).send('OOPS!! 404 page not found');
});

app.use(errorMiddleware);

// db init
connectToDb();

export default app;
