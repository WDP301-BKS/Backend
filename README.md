# Football Field Booking Backend

Backend API service for the Football Field Booking platform. This application provides APIs for user authentication, field management, booking, and payment processing.

## Technologies Used

- Node.js & Express.js
- PostgreSQL
- Sequelize ORM
- JWT Authentication
- Nodemailer
- Google OAuth
- Multer for file uploads

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

## Getting Started

### Installation

1. Clone the repository
```
git clone <repository-url>
cd Backend
```

2. Install dependencies
```
npm install
```

3. Environment Setup
```
cp env.example .env
```
Edit the `.env` file with your specific configuration

### Database Setup

Ensure PostgreSQL is running and create a database:

```
createdb football_booking
```

The tables will be automatically created when the application first runs (via Sequelize sync).

### Running the Application

**Development mode**
```
npm run dev
```

**Production mode**
```
npm start
```

The server will start on the port specified in the `.env` file (default: 5000).

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh authentication token
- `POST /api/auth/google` - Google OAuth authentication
- `GET /api/auth/verify-email/:token` - Verify user email

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/change-password` - Change password

### Field Management (Protected with admin rights)
- `POST /api/fields` - Add a new field
- `GET /api/fields` - Get all fields
- `GET /api/fields/:id` - Get field by ID
- `PUT /api/fields/:id` - Update field
- `DELETE /api/fields/:id` - Delete field

### Booking
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Payment
- `POST /api/payments` - Process payment
- `GET /api/payments` - Get payment history
- `GET /api/payments/:id` - Get payment details

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── models/         # Database models
├── routes/         # API routes
├── middlewares/    # Custom middlewares
├── services/       # Business logic
├── repositories/   # Data access layer
├── utils/          # Utility functions
├── common/         # Common resources
└── index.js        # Entry point
```

## Development

### Adding New Models

1. Create a new model file in `src/models/`
2. Import and register in `src/models/index.js`
3. Define associations if needed

### Adding New Routes

1. Create a new route file in `src/routes/`
2. Import and register in `src/routes/index.js`

## Testing

```
npm test
```

## Documentation

API documentation is available at `/api-docs` when the server is running.

## Deployment

1. Set the environment variables for production
2. Build the application:
```
npm run build
```
3. Start the server:
```
npm start
```

## License

[MIT License](LICENSE) 