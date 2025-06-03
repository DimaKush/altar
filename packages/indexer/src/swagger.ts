import swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Altar Indexer API',
      version: '1.0.0',
      description: 'API for Altar Protocol Indexer',
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/api.ts'], // Path to the API docs
};

export const specs = swaggerJsdoc(options); 