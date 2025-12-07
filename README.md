# ListFlow - List Management Application

<!-- Triggering a new build in Tempo - Dec 7, 2025 -->

A clean, intuitive dashboard that allows users to create, organize and manage multiple types of lists in one place with easy categorization and quick-access features.

## Features

### ✅ Core Functionality
- **User Authentication**: Register and login with email/password
- **Central Dashboard**: View all lists organized by categories (Tasks, Groceries, Ideas, Shopping, Travel, Other)
- **List Management**: Create, edit, and delete lists with full CRUD operations
- **Item Management**: Add, edit, reorder, and delete items within lists
- **Rich Item Attributes**: 
  - Priority levels (Low, Medium, High)
  - Due dates with calendar picker
  - Notes for additional context
  - Completion status tracking

### 🎯 Advanced Features
- **Drag & Drop Reordering**: Easily reorder items within lists
- **Pin Lists**: Pin important lists for quick access
- **Category Filtering**: Filter lists by category
- **Progress Tracking**: Visual progress bars showing completion rates
- **Import/Export**: 
  - Import lists from CSV or TXT files
  - Export lists to CSV or TXT formats
- **User Profile**: View account details and usage statistics
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### 📊 Statistics
- Total lists count
- Total items count
- Completed items tracking
- Pinned lists count
- Completion rate percentage

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **State Management**: React Context API
- **Storage**: LocalStorage for data persistence

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Create Lists**: Click "New List" to create a list in any category
3. **Add Items**: Add items to your lists with optional priority, due dates, and notes
4. **Organize**: Drag and drop to reorder items, pin important lists
5. **Track Progress**: View completion rates and statistics
6. **Import/Export**: Backup or share your lists using CSV or TXT formats

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Main dashboard view
│   ├── list/           # List detail and management
│   ├── import-export/  # Import/Export functionality
│   ├── profile/        # User profile and statistics
│   └── ui/             # Reusable UI components (shadcn)
├── contexts/
│   ├── AuthContext.tsx # Authentication state management
│   └── ListContext.tsx # List data management
├── types/
│   └── index.ts        # TypeScript type definitions
└── App.tsx             # Main app component with routing
```

## Data Persistence

All data is stored in the browser's LocalStorage, including:
- User authentication state
- All lists and their items
- User preferences (pinned lists, etc.)

## Future Enhancements

- Backend integration with Supabase or similar
- Real-time collaboration
- List sharing with other users
- Tags and advanced filtering
- Search functionality
- Dark mode support
- Mobile app version