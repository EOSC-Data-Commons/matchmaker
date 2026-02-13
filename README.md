![EOSC Data Commons](src/assets/data-commons-logo.png)

[![License: MIT](https://img.shields.io/badge/GitHub-MIT-informational)](LICENSE)

# EOSC Data Commons Frontend

A web application for searching scientific datasets using natural language queries. This application works with the [EOSC Data Commons Search server](https://github.com/EOSC-Data-Commons/data-commons-search) to help you discover scientific datasets through AI-powered search.

## What You Need First

Before using this application, you need to install these programs on your computer:

1. **[Node.js](https://nodejs.org/en/download/)** (version 20 or newer)
   - Download and install from the official website
   - This includes npm (package manager) automatically
   - **Development version used**: Node.js 24.3.0
   - **Minimum required**: Node.js 20.x LTS or newer

2. **[Git](https://git-scm.com/downloads)**
   - Download and install from the official website
   - Needed to download the code

3. **[EOSC Data Commons MCP server](https://github.com/EOSC-Data-Commons/data-commons-mcp)**
   - Download and set up the backend server
   - Must be running on port 8000 for this frontend to work

You can check if they're installed by opening Terminal (Mac) or Command Prompt (Windows) and running these commands one by one:

Check Node.js version:
```bash
node --version
```

Check npm version:
```bash
npm --version
```

Check Git version:
```bash
git --version
```

## How to Use

### Step 1: Download the Code

Open Terminal (Mac) or Command Prompt (Windows) and run these commands one by one:

Clone the repository:
```bash
git clone https://github.com/EOSC-Data-Commons/matchmaker.git
```

Navigate to the project folder:
```bash
cd matchmaker
```

Install dependencies:
```bash
npm install
```

### Step 2: Set Up the Backend (EOSC Data Commons search server)

Follow the instructions in the backend [README](https://github.com/EOSC-Data-Commons/data-commons-search) to set up and run the server. The frontend expects the backend to be running on port 8000 by default.

> [!NOTE]
> If you are running the backend with Docker and encounter an error of HTTP 401, related to `SEARCH_API_KEY=SECRET_KEY_YOU_CAN_USE_IN_FRONTEND_TO_AVOID_SPAM`, try removing or commenting out the `SEARCH_API_KEY` line in your backend `.env` file. The backend does not require this key unless you want to restrict API access.

### Step 3: Start the Frontend

Run this command to start the frontend:
```bash
npm run dev
```

The application will open at http://localhost:5173

## Authenticate with GitHub Container Registry (GHCR)

Before pulling images from GHCR, you may need to log in. Use the following command:

```bash
docker login ghcr.io
```

You will be prompted for your GitHub username and a [personal access token](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry) with appropriate permissions (use as password).

For more details, see the official GitHub documentation:  
https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry

## Run with Docker (Alternative to Local Node.js)

If you prefer not to install Node.js and npm, you can run the frontend directly using Docker. The backend server must still be running and accessible (see above).

### Pull the Docker image

You can pull the latest published image from GitHub Container Registry:

```bash
docker pull ghcr.io/eosc-data-commons/matchmaker-frontend:latest
```

Or pull a specific version (replace `<version>` with the version you want, e.g., `1.2.3`):

```bash
docker pull ghcr.io/eosc-data-commons/matchmaker-frontend:<version>
```

### Run the Docker container

To run the frontend container and map it to your local port 5173:

```bash
docker run -p 5173:80 ghcr.io/eosc-data-commons/matchmaker-frontend:latest
```

- The app will be available at http://localhost:5173
- Make sure your backend server is running and accessible to the container (default: http://localhost:8000)

> [!NOTE]
>
> If running backend and frontend in separate containers, you may need to adjust CORS or network settings for them to communicate.


## How to Search

1. Open the application in your web browser
2. Type your search in plain English, for example:
   - "data about diabetes research in Europe"
   - "climate change temperature data from 2000 to 2020"
3. Press Enter or click the search button
4. Browse through the results

## Need Help?

If something doesn't work:
1. Make sure the backend server is running first
2. Check that Node.js and Git are properly installed
3. Try closing and reopening your terminal/command prompt
