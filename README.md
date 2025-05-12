# World Connect - Video Chat Application

World Connect is a video chat application that allows users to connect with random strangers from around the world, similar to Ome.tv. The application is built with React, TypeScript, and Firebase.

## Features

- **Random Video Matching**: Connect with random people through video chat
- **User Profiles**: Create and customize your profile
- **Text Chat**: Chat with your video partner in real-time
- **Next Feature**: Skip to the next random person
- **Authentication**: Secure login with email/password or Google authentication
- **Reporting**: Report inappropriate behavior

## Technology Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **Video Chat**: WebRTC
- **Hosting**: Firebase Hosting

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/world-connect.git
cd world-connect
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with your Firebase configuration:

```
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

4. Start the development server:

```bash
npm start
# or
yarn start
```

5. The application will be available at `http://localhost:3000`.

## Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Google provider)
3. Enable Firestore Database
4. Deploy the security rules and indexes for Firestore:

```bash
firebase login
firebase deploy --only firestore
```

## Deployment

1. Build the application:

```bash
npm run build
# or
yarn build
```

2. Deploy to Firebase Hosting:

```bash
firebase deploy --only hosting
```

## Testing the Application

1. Create at least two accounts to test the video chat functionality
2. Set up your profile with a username and preferences
3. Start video chatting and test the messaging feature

## Project Structure

```
world-connect/
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore indexes
├── public/                  # Public assets
├── src/                     # Source code
│   ├── components/          # React components
│   │   ├── Header.tsx       # App header/navigation
│   │   ├── Login.tsx        # Authentication component
│   │   ├── Profile.tsx      # User profile management
│   │   └── VideoChat.tsx    # Main video chat functionality
│   ├── lib/                 # Service and utility functions
│   │   ├── firebase.ts      # Firebase initialization
│   │   ├── userService.ts   # User-related operations
│   │   ├── roomService.ts   # Room and chat operations
│   │   └── reportService.ts # User reporting functionality
│   ├── App.tsx              # Main App component
│   └── index.tsx            # Entry point
├── firebase.json            # Firebase configuration
└── tailwind.config.js       # Tailwind CSS configuration
```

## Key Implementation Details

1. **Authentication**: Uses Firebase Auth for email/password and Google sign-in
2. **User Profiles**: Stored in Firestore with customizable fields
3. **Video Chat**: Implements WebRTC for peer-to-peer video connections
4. **Matchmaking**: Randomly pairs online users for video chat
5. **Text Chat**: Real-time messaging between connected users
6. **Reporting System**: Allows users to report inappropriate behavior

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Firebase](https://firebase.google.com/) for the backend services
- [WebRTC](https://webrtc.org/) for the video chat functionality
- [Tailwind CSS](https://tailwindcss.com/) for the styling
- [React](https://reactjs.org/) for the frontend framework
