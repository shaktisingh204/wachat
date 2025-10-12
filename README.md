# SabNode - Business Communication & Growth Platform

This document provides a comprehensive guide to setting up, running, and using the SabNode application, including its high-throughput WhatsApp broadcasting system powered by Redpanda/Kafka.

## Table of Contents

1.  [Prerequisites](#prerequisites)
2.  [Environment Setup](#environment-setup)
3.  [Running the Application](#running-the-application)
    - [Development Mode](#development-mode)
    - [Production Mode](#production-mode)
    - [Running in Production with PM2](#running-in-production-with-pm2)
4.  [High-Throughput Broadcasting System](#high-throughput-broadcasting-system)
    - [1. Start Redpanda (Kafka)](#1-start-redpanda-kafka)
    - [2. Run the Broadcast Producer (Optional Test)](#2-run-the-broadcast-producer-optional-test)
    - [3. Start the Broadcast Workers](#3-start-the-broadcast-workers)
    - [4. Triggering a WhatsApp Broadcast](#4-triggering-a-whatsapp-broadcast)

## Prerequisites

Before you begin, ensure you have the following installed on your system:
*   **Node.js** (v18.x or later recommended)
*   **npm** or a compatible package manager
*   **Docker** (for running Redpanda)

## Environment Setup

1.  **Clone the Repository**:
    ```bash
    git clone <your-repository-url>
    cd <your-project-directory>
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Create Environment File**:
    Create a file named `.env.local` in the root of your project and populate it with the necessary credentials. Use the `.env.example` file as a template.

    **Critical Variables:**
    ```env
    # SabNode Core Configuration
    MONGODB_URI=your_mongodb_connection_string
    MONGODB_DB=your_mongodb_database_name
    JWT_SECRET=a_long_random_secure_string_for_sessions

    # Meta/Facebook Integration (Required for Facebook & WhatsApp)
    NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
    FACEBOOK_APP_SECRET=your_facebook_app_secret
    NEXT_PUBLIC_META_CONFIG_ID=your_facebook_login_config_id

    # This must be your publicly accessible application URL
    NEXT_PUBLIC_APP_URL=https://your-app-domain.com

    # Meta Webhooks (for receiving messages and updates)
    META_VERIFY_TOKEN=a_random_secure_string_for_webhooks

    # Google AI for Genkit Features
    GOOGLE_API_KEY=your_google_ai_api_key

    # Admin Login Credentials
    ADMIN_EMAIL=admin@example.com
    ADMIN_PASSWORD=secure_admin_password

    # Kafka/Redpanda Configuration
    # If running Redpanda via Docker, this is usually correct.
    KAFKA_BROKERS=127.0.0.1:9092
    ```

## Running the Application

You can run the application in two modes:

### Development Mode

This mode is ideal for local development and testing, with hot-reloading enabled.

```bash
npm run dev
```
The application will be available at `http://localhost:3001`.

### Production Mode

This mode builds the application for production and starts a clustered server optimized for performance.

1.  **Build the application**:
    ```bash
    npm run build
    ```
2.  **Start the production server**:
    ```bash
    npm start
    ```
This will start the application in the foreground of your terminal.

### Running in Production with PM2

To keep the application running in the background and automatically restart it on crashes, we recommend using PM2, a production process manager for Node.js applications.

1.  **Install PM2 Globally**:
    If you don't have PM2 installed, open your terminal and run:
    ```bash
    npm install pm2 -g
    ```

2.  **Start the Application with PM2**:
    Make sure you have already built the application (`npm run build`). Then, from your project root, run:
    ```bash
    npm run start:pm2
    ```
    This command will start the application cluster in the background, managed by PM2. Your `server.js` file is already configured to handle clustering, and PM2 will manage the primary process.

3.  **Managing the Application**:
    Here are some common commands to manage your application with PM2:
    *   **List all running applications**: `pm2 list`
    *   **View logs**: `pm2 logs sabnode`
    *   **Stop the application**: `pm2 stop sabnode`
    *   **Restart the application**: `pm2 restart sabnode`
    *   **Delete the application from PM2's list**: `pm2 delete sabnode`

## High-Throughput Broadcasting System

The WhatsApp broadcasting feature uses Redpanda (a Kafka-compatible event streaming platform) for high performance. Follow these steps to set it up.

### 1. Start Redpanda (Kafka)

The easiest way to run Redpanda is with Docker. Open a new terminal window and run the following command. Keep this terminal open while you work.

```bash
docker run --rm -it -p 9092:9092 -p 9644:9644 redpandadata/redpanda:latest \
  redpanda start --smp 1 --overprovisioned --node-id 0 --kafka-addr 0.0.0.0:9092 --advertise-kafka-addr 127.0.0.1:9092
```
This command starts a single Redpanda broker and makes it available on `localhost:9092`.

### 2. Run the Broadcast Producer (Optional Test)

The `producer.js` script is a benchmark tool designed to flood the `messages` topic with millions of test messages to check the system's throughput. It is **not** required for normal WhatsApp broadcasting.

To run the benchmark:
```bash
node producer.js
```
You will see output indicating the message sending progress and final throughput.

### 3. Start the Broadcast Workers

The workers are the consumers that actually process the broadcast queue and send WhatsApp messages.

*   **In Development**: You do not need to run a separate worker command. The main `npm run dev` process handles this.
*   **In Production**: The `npm start` or `npm run start:pm2` command automatically forks a worker process for each available CPU core, using the `server.js` script. **You do not need to run a separate command for the workers.** They run in the background as part of the main application process.

### 4. Triggering a WhatsApp Broadcast

Here is the complete workflow for sending a broadcast:

1.  **Ensure Redpanda is running** (from Step 1).
2.  **Start the application** (`npm run dev` or `npm start` / `npm run start:pm2`).
3.  **Queue a Broadcast**: Go to the SabNode dashboard, navigate to "Campaigns", and create a new broadcast campaign by selecting a template and uploading a contact list.
4.  **Trigger the Cron Job**: The system uses a cron job to find queued broadcasts and push them to Kafka. In production, this happens automatically. In development, you must trigger it manually by opening this URL in your browser:
    ```
    http://localhost:3001/api/cron/send-broadcasts
    ```
5.  **Monitor the Output**: Check the terminal where you are running your application (`npm run dev` or `npm start`) or use `pm2 logs sabnode` if using PM2. You will see logs from the workers as they pick up and process the message batches from Kafka.

---
That's it! Your SabNode application is now fully configured for development and production, including the high-performance broadcasting system.