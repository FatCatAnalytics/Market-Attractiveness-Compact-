# Market Attractiveness Dashboard

A React-based dashboard for analyzing market attractiveness and franchise performance across MSAs (Metropolitan Statistical Areas). Built from a Figma design with local CSV data integration.

## Features

- **Market Attractiveness Analysis**: Visualize market data across different MSAs
- **Franchise Comparison**: Compare multiple franchises with detailed metrics
- **Regional Analysis**: View market presence by region with top MSAs
- **Interactive Visualizations**: 
  - USA Map with market data
  - Radar charts showing franchise strengths
  - Bar charts and pie charts for market distribution
- **CSV Data Integration**: Loads data from local CSV files (no database required)

## Tech Stack

- **React** with TypeScript
- **Vite** for build tooling
- **Recharts** for data visualization
- **Radix UI / Shadcn UI** for components
- **Tailwind CSS** for styling

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Navigate to the Figma Import directory:
```bash
cd "Figma Import"
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173` (or the port shown in terminal)

## Project Structure

```
├── Figma Import/          # Main application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # Data services and utilities
│   │   └── types.ts       # TypeScript definitions
│   └── public/            # CSV data files
├── older version/          # Previous version reference
└── public/                # Additional CSV files
```

## Data Files

The application uses CSV files located in `public/`:
- `attractivenes.csv` - Market attractiveness data
- `opportunity.csv` - Opportunity and provider data
- `geo_maps.csv` - Geographic mapping data

## Key Components

- **TargetOpportunities**: Franchise comparison with radar charts
- **MSAExplorer**: Interactive map and market exploration
- **MSADetailView**: Detailed MSA analysis
- **WhatIfAnalysis**: Scenario analysis with filters

## License

This project is based on a Figma design. Please refer to the original design for usage rights.
