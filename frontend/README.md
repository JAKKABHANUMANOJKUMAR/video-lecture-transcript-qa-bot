# Video Lecture Transcript Q&A Bot - Frontend

A modern, professional Q&A interface for video lecture transcripts with separate admin and user modules. **Fully functional demo with hardcoded data - no database required!**

## Features

### Admin Module
- **Dashboard**: Statistics on user engagement, system health, and platform metrics
- **Statistics Cards**: Total users, online users, average usage time, pending alerts
- **User Activity Charts**: Visualize daily active users and engagement trends
- **Quick Alerts Panel**: System notifications including new users, transcript failures, and resolved complaints
- **User Management Table**: View users with login status and activity details
- **Navigation Sidebar**: Dashboard, Alerts, Users, Analytics, Settings

### User Module
- **Chat Interface**: Ask questions about lecture transcripts
- **Suggested Questions**: Quick templates for common questions
- **Message History**: View conversation history
- **Navigation Sidebar**: New Chat, Library, Recent, Raise Complaint, Settings

### Design Features
- **Professional UI**: Modern, clean aesthetic matching reference designs
- **Fully Responsive**: Works perfectly on mobile, tablet, and desktop
- **Smooth Animations**: Interactive hover effects and transitions
- **Dark Mode Ready**: CSS prepared for dark mode support

## Architecture

### Frontend Technologies
- **React 18**: UI framework with hooks
- **TypeScript**: Full type safety and developer experience
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Professional icon library
- **Vite**: Ultra-fast build tool

### Data
- **Hardcoded Demo Data**: No database required
- **Demo Users**: Admin and User accounts with instant login
- **Sample Statistics**: Realistic dashboard metrics
- **Mock Alerts**: Sample system notifications

## Getting Started

### Demo Credentials

**Admin Account:**
- Email: `admin@example.com`
- Password: `password`

**User Account:**
- Email: `user@example.com`
- Password: `password`

### Quick Start

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5173`

3. **Build for Production:**
   ```bash
   npm run build
   ```
   Creates optimized `dist/` folder

## Project Structure

```
src/
├── pages/
│   ├── LoginPage.tsx          # Authentication page
│   ├── AdminDashboard.tsx     # Admin main dashboard
│   └── UserDashboard.tsx      # User chat interface
├── components/
│   ├── AdminSidebar.tsx       # Admin navigation sidebar
│   └── UserSidebar.tsx        # User navigation sidebar
├── lib/
│   ├── supabase.ts            # Supabase client setup
│   └── auth-context.tsx       # Auth context and hooks
├── App.tsx                    # Main app component with routing
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

## Design System

### Color Palette
- **Primary**: Green (600/400) - Main actions and highlights
- **Secondary**: Slate (900) - Dark text and heavy elements
- **Neutrals**: Slate 50-900 - Full range for UI elements
- **Status Colors**: Red (errors), Green (success), Blue (info), Yellow (warnings)

### Typography
- **Font Family**: System fonts (SF Pro, Segoe UI, Roboto)
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Sizes**: 12px (xs), 14px (sm), 16px (base), 18px (lg), 24px (2xl), 30px (3xl)

### Components
- **Cards**: Rounded corners (8px), subtle borders, light shadows
- **Buttons**: Full-width or auto-width, hover effects
- **Inputs**: 32px height, border focus states
- **Sidebars**: Fixed width (256px), smooth mobile transitions

## User Flows

### Admin Login Flow
1. Enter email/password credentials
2. System authenticates and checks role
3. Admin dashboard loads with statistics
4. Can navigate between Dashboard, Alerts, Users, Analytics, Settings

### User Login Flow
1. Enter email/password credentials
2. System authenticates and checks role
3. User chat interface loads (Ask Ora)
4. Can browse lectures, ask questions, view recent chats, file complaints

## Security Considerations

### Privacy Protection
- Admins cannot access user transcripts or chat histories
- Questions and answers are stored securely with user isolation
- Complaints are visible only to admins and the filing user
- Statistics are aggregated to prevent individual tracking

### Data Validation
- All inputs validated on frontend before submission
- Backend RLS policies enforce additional security
- Database constraints prevent invalid data

### Authentication
- Secure session management via Supabase
- Automatic logout on session expiry
- Protected routes check user role before rendering

## Performance Optimizations

- Code splitting via Vite
- Lazy loading components as needed
- Optimized re-renders with React hooks
- Responsive design for all screen sizes
- Mobile-first sidebar navigation

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

- Real-time chat updates with Supabase Realtime
- Audio/video playback with timestamp linking
- Advanced search and filtering
- User activity analytics
- Chat export and transcript generation
- Complaint resolution tracking
- Custom lecture uploads
- Integration with video platforms

## Support

For issues or questions, please use the complaint system in the user dashboard or contact the support team.

---

Built with React, TypeScript, Tailwind CSS, and Supabase
