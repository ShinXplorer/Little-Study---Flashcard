# Little Study

> **Status: Work in Progress (WIP)**  
> Little Study is currently actively under development. New features, UI improvements, and integrations are being added regularly.

Little Study is a clean, modern, and responsive flashcard web application designed to make studying intuitive and enjoyable. Create custom decks, study with interactive 3D flip animations, and seamlessly keep your progress saved locally or synchronized across devices using Firebase.

---

## Upcoming Features and Roadmap (In Progress)

The project is evolving! The following features are currently planned or in active development:

- [ ] **Edit Cards**: In-place editing of existing flashcards within decks without having to re-create them.
- [ ] **Post-Login UI Preferences**: Customizable interface themes, study views, and personalized dashboard settings applied upon successful login.
- [ ] **AI Integration**: AI-assisted card generation (generating question/answer pairs from notes or topics) and smart study recommendations.
- [ ] **Non-Copyrighted Study Music**: Integrated royalty-free, non-copyrighted background music and ambient sounds to boost focus during study sessions.

---

## Current Features

- **Interactive 3D Flashcards**: Smooth card flip animations for questions and answers.
- **Deck and Card Management**: Create custom decks, add cards, and organize study sets.
- **Dual-Mode Persistence**:
  - **Local Mode**: Works instantly out of the box in the browser without any login.
  - **Cloud Sync**: Optional Google sign-in with Firebase Authentication and Cloud Firestore for real-time cross-device sync.
- **Responsive and Lightweight**: Built with standard web technologies and Vite for fast performance.

---

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, Modern CSS3
- **Bundler and Dev Server**: [Vite](https://vite.dev/)
- **Backend and Auth**: [Firebase](https://firebase.google.com/) (Authentication & Cloud Firestore)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- `npm` or your preferred package manager

### Run Locally

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-username/little-study.git
   cd little-study
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Start the local development server:**
   ```sh
   npm run dev
   ```

4. Open the local URL printed in your terminal (typically `http://localhost:5173`).

> *Note:* Without Firebase credentials configured, Little Study runs seamlessly in local mode, storing decks in your browser's local storage.

---

## Optional: Firebase Setup (Cloud Sync and Google Sign-In)

To enable cloud synchronization and Google account authentication:

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a **Web App** and paste your configuration into [src/firebase-config.js].
3. In **Authentication -> Sign-in method**, enable **Google**.
4. In **Authentication -> Settings -> Authorized domains**, ensure your local (`localhost`) and production domains are listed.
5. Create a **Cloud Firestore** database and publish the security rules provided in [firestore.rules].
6. Build for production when ready:
   ```sh
   npm run build
   ```

---

## License

This project is open-source and available under the [MIT License](LICENSE).
