import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import apiRoutes from './routes/api.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*', // For development
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
}));

// Use express.json with generic fallback, but not for stripe webhooks
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON payload provided. Please check for trailing commas or malformed structure.' });
  }
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve PDF downloads

// Swagger setup
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Boat Lift Protection API',
      version: '1.0.0',
      description: 'API documentation for Boat Lift Protection Dashboard App',
    },
    servers: [
      { url: 'http://localhost:5000' }
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // files containing annotations
};

const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});
