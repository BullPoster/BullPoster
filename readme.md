# BullPoster

BullPoster is a groundbreaking platform on the Solana blockchain designed to enhance promotional activities through engaging campaigns called "raids". Creators can launch these raids to increase visibility, while users earn BullPoster tokens by participating and promoting content on platforms like X and Reddit.

## Table of Contents

1. [Blinks x Actions by Dialect Integration](#blinks-x-actions-by-dialect-integration)
2. [Smart Contract (Native Rust)](#smart-contract-native-rust)
3. [Backend](#backend)
4. [Frontend](#frontend)
5. [Setup and Installation](#setup-and-installation)
6. [Contributing](#contributing)
7. [License](#license)

## Blinks x Actions by Dialect Integration

### Overview

Blinks x Actions by Dialect integration enhances user interaction and engagement on X by providing interactive components directly within the social media platform. This integration includes various features that enable seamless participation and management of raids.

### Technical Features

- **User Cards**: 
  - **User Profile**: Displays user info and statistics.
    - **Live Raid Action**: Displays the Raid Card of a ongoing raid in which the program is participating in ( On displays if a program is currently participating in a raid).  
    - **View Past Raids Action**: Lists historical raids the user has participated in.
    - **Enrolled Programs Action**: Shows all programs the user is currently enrolled in.

- **Leaderboard Blink**: 
  - **Overall Stats**: Highlights top users and programs based on various metrics.
  - **Competition Stats**: Provides detailed rankings for specific competitions.

- **Raid Card**:
  - **Competition Stats**: Displays current stats of raid and participant rankings for ongoing competition.
    - **Join Action**: Enables users to join the program and participate in raids.
    - **Burn Action**: Allows users to burn tokens directly from the Blinks interface during live raids, integrating with the competitive token burning mechanism.

- **Program Card Raid**:
  - **Program Details**: Displays information about the program and raid stats.
    - **Live Raid Action**: Displays the Raid Card of a ongoing raid in which the program is participating in ( On displays if a program is currently participating in a raid).  
    - **Past Raids**: Shows previous raids related to the program.

## Smart Contract (Native Rust)

### Overview

The smart contracts for BullPoster are developed using Rust and are deployed on the Solana blockchain. They handle critical functionalities including token management, staking, and competitive features.

### Technical Features

- **Program Derived Addresses (PDAs)**:
  - Used for deterministic account creation and management.

- **Competitive Burn Feature**:
  - Allows users to burn tokens as part of a competitive mechanism to increase reward probibilities. This feature includes:
    - Token burning operations
    - Managing burn rates and rewards

- **Program Staking**:
  - Programs must stake tokens to activate their participation in the BullPoster ecosystem. Key features include:
    - Token transfer to stake vault
    - Updating staked amounts

## Backend

### Overview

The backend of BullPoster is built using Django and is responsible for managing user interactions, program details, and integration with the Solana blockchain.

### Technical Features

- **Framework**: Django
  - **Database**: PostgreSQL
  - **Authentication**: Custom authentication using Solana wallet signatures
  - **API**: RESTful API for communication between frontend and backend
  - **Blockchain Interaction**: Integration with Solana via web3.js

- **User Management**:
  - Handles user profiles, authentication, and authorization based on Solana wallet keys.
  - Tracks user statistics, rewards, and participation history.

- **Program Management**:
  - Manages program creation, updating, and deletion.
  - Handles program staking and activation.
  - Tracks raid statuses and rewards distribution.

- **Raid Management**:
  - Facilitates the initiation and management of raids.
  - Handles competition types, reward distribution, and leaderboard updates.

## Frontend

### Overview

The frontend of BullPoster is developed using React and provides an intuitive interface for users and creators to interact with the platform.

### Technical Features

- **Framework**: React
  - **State Management**: Utilizes React Hooks and Context API for managing application state.
  - **Styling**: Tailwind CSS for responsive and modern UI design.
  - **Wallet Integration**: Connects with Solana wallets using @solana/wallet-adapter libraries.

- **Creator Dashboard**:
  - Allows creators to manage their programs, view statistics, and initiate raids.

- **User Dashboard**:
  - Provides users with an overview of their participation, rewards, and available raids.

- **Raid Interaction**:
  - Users can join raids, track progress, and view real-time updates.

- **Leaderboard and Stats**:
  - Displays leaderboards, competition stats, and user rankings.

## Setup and Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-repo/bullposter.git
   cd bullposter
   ```

2. **Backend Setup**
   - Create a virtual environment and install dependencies:
     ```bash
     python -m venv env
     source env/bin/activate
     pip install -r requirements.txt
     ```
   - Run database migrations:
     ```bash
     python manage.py migrate
     ```

3. **Frontend Setup**
   - Install frontend dependencies:
     ```bash
     cd frontend
     npm install
     ```

4. **Smart Contracts**
   - Build and deploy Rust smart contracts:
     ```bash
     cd rust_contracts
     cargo build-bpf
     ```

5. **Start Development Servers**
   - Backend: `python manage.py runserver`
   - Frontend: `npm start`

## Contributing

We welcome contributions to BullPoster! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

BullPoster is released under the [MIT License](LICENSE).
```

This `README.md` provides a structured overview of BullPoster, including detailed technical features and specifications for Blinks x Actions by Dialect integration, Rust smart contracts, backend, and frontend components. Let me know if there are any other details you'd like to include or adjust!
