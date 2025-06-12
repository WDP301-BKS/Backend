# Football Field Booking Backend

Backend API service for the Football Field Booking platform. This application provides APIs for user authentication, field management, booking, and payment processing.

## Features

- User authentication (register, login, email verification)
- User profile management
- Field management for owners
- Booking system for customers
- Review and rating system
- Admin dashboard for system management

## New Features

### Profile Management
- Update profile information (name, email, phone, bio, gender, date of birth, address)
- Upload and manage profile images with Cloudinary
- Change password

### Password Reset
- Request password reset via email
- Reset password with token

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
- Cloudinary account (for image uploads)

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

The server will start on the port specified in the `.env` file (default: 5001).

## Environment Variables

Update your `.env` file with the following variables:

```
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=no-reply@football-booking.com
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh authentication token
- `POST /api/auth/google` - Google OAuth authentication
- `GET /api/auth/verify-email/:token` - Verify user email
- `GET /api/auth/verify/:token` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/profile/image` - Upload profile image
- `DELETE /api/users/profile/image` - Delete profile image
- `POST /api/users/change-password` - Change password
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID (admin only)
- `PUT /api/users/:id` - Update user by ID (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

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

## Using the New Features

### Profile Image Upload

To upload a profile image:

```javascript
// Frontend code example
const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  
  try {
    const response = await fetch('/api/users/profile/image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}` // Your auth token
      },
      body: formData
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw error;
  }
};
```

### Updating Profile Information

To update profile information:

```javascript
// Frontend code example
const updateProfile = async (profileData) => {
  try {
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Your auth token
      },
      body: JSON.stringify(profileData)
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};
```

### Password Reset Flow

1. User requests password reset:

```javascript
// Frontend code example
const requestPasswordReset = async (email) => {
  try {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
};
```

2. User receives email with reset link
3. User clicks link and is redirected to reset password page
4. User submits new password:

```javascript
// Frontend code example
const resetPassword = async (token, newPassword) => {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, newPassword })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};
``` 