# ID Card Scanner - React Frontend

A mobile-first React TypeScript application for scanning and analyzing ID cards with fraud detection capabilities.

## Features

- 📸 **Camera Integration**: Capture ID card images using device camera
- 📤 **Image Upload**: Upload existing images from device storage
- 🔍 **Data Extraction**: Extract information from ID cards using OCR
- 🛡️ **Fraud Detection**: Run security checks including:
  - Hologram detection
  - Red line verification
  - Spoof detection
  - Information verification
  - Location code validation

## Tech Stack

- **React 18** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Lucide React** for icons
- Mobile-first responsive design

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm start
\`\`\`

The app will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

\`\`\`bash
npm run build
\`\`\`

## Project Structure

\`\`\`
src/
├── components/          # React components
│   ├── ExtractDataTab.tsx
│   └── FraudDetectionTab.tsx
├── pages/              # Page components
│   ├── CapturePage.tsx
│   └── ResultsPage.tsx
├── App.tsx             # Main app component
├── App.css             # App styles
└── index.tsx           # Entry point
\`\`\`

## Usage

### Page 1: Capture

- Click **"Start Camera"** to use device camera
- Or click **"Upload Image"** to select an image from storage
- Capture or select an ID card image
- Click **"Process"** to analyze the image

### Page 2: Results

Two tabs are available:

1. **Extract Data Tab**: Displays extracted information from the ID card
   - ID Number
   - Name and Last Name
   - Date of Birth
   - Issue and Expiry Dates
   - Address

2. **Fraud Detection Tab**: Shows security check results
   - Overall verification status
   - Individual security checks with pass/fail status
   - Detailed messages for each check

## API Integration

Currently, the app uses mock data for demonstration. To integrate with your backend:

1. Update the API endpoints in:
   - src/components/ExtractDataTab.tsx (line ~30)
   - src/components/FraudDetectionTab.tsx (line ~36)

2. Replace mock data fetching with actual API calls

## Design

- **Theme**: Black and white minimal design
- **Mobile-first**: Optimized for mobile devices
- **Desktop view**: Centered with max-width constraint (480px)

## Available Scripts

- \`npm start\` - Run development server
- \`npm run build\` - Build for production
- \`npm test\` - Run tests

## License

MIT
