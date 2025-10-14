# SabNode - Business Communication & Growth Platform

This document provides a comprehensive guide to setting up, running, and using the SabNode application, including its high-throughput WhatsApp broadcasting system powered by Redpanda/Kafka.

## Table of Contents

1.  [Prerequisites](#prerequisites)
2.  [Environment Setup](#environment-setup)
3.  [Running the Application](#running-the-application)
    - [Development Mode](#development-mode)
    - [Production Mode](#production-mode)
4.  [High-Throughput Broadcasting System](#high-throughput-broadcasting-system)
    - [1. Start Redpanda (Kafka)](#1-start-redpanda-kafka)
    - [2. Triggering a WhatsApp Broadcast](#2-triggering-a-whatsapp-broadcast)

## Prerequisites

Before you begin, ensure you have the following installed on your system:
*   **Node.js** (v18.x or later recommended)
*   **npm** or a compatible package manager
*   **Docker** (for running Redpanda)
*   **PM2** (a production process manager for Node.js)
    ```bash
    npm install pm2 -g
    ```

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
    Create a file named `.env` in the root of your project and populate it with the necessary credentials.

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

### Development Mode

This mode is ideal for local development and testing, with hot-reloading enabled.

```bash
npm run dev
```
The application will be available at `http://localhost:3001`.

### Production Mode

This mode builds the application for production and starts a clustered server using PM2 for both the web server and the background broadcast workers.

1.  **Build the application**:
    ```bash
    npm run build
    ```
2.  **Start the production cluster**:
    ```bash
    npm run start:pm2
    ```
    This command reads the `ecosystem.config.js` file and starts both the Next.js web application and the dedicated broadcast workers in the background.

3.  **Managing the Application**:
    Here are some common commands to manage your application with PM2:
    *   **List all running applications**: `pm2 list`
    *   **View logs for the web server**: `pm2 logs sabnode-web`
    *   **View logs for the workers**: `pm2 logs sabnode-worker`
    *   **Stop all applications**: `npm run stop:pm2` or `pm2 stop all`
    *   **Restart all applications**: `pm2 restart all`
    *   **Delete all applications from PM2's list**: `pm2 delete all`

## High-Throughput Broadcasting System

The WhatsApp broadcasting feature uses Redpanda (a Kafka-compatible event streaming platform) for high performance. Follow these steps to set it up.

### 1. Start Redpanda (Kafka)

The easiest way to run Redpanda is with Docker. Open a new terminal window and run the following command. Keep this terminal open while you work.

**Standard Command (Default 1MB message limit)**
```bash
docker run --rm -it -p 9092:9092 -p 9644:9644 redpandadata/redpanda:latest \
  redpanda start --smp 1 --overprovisioned --node-id 0 --kafka-addr 0.0.0.0:9092 --advertise-kafka-addr 127.0.0.1:9092
```

**High-Throughput Command (100MB message limit)**
If you are sending very large broadcasts (tens of thousands of contacts), use this command to increase the message size limit.
```bash
docker run --rm -it -p 9022:9092 -p 9644:9644 redpandadata/redpanda:latest \
  redpanda start \
    --smp 1 \
    --overprovisioned \
    --node-id 0 \
    --kafka-addr 0.0.0.0:9092 \
    --advertise-kafka-addr 127.0.0.1:9092 \
    --set redpanda.kafka_message_max_bytes=104857600 \
    --set redpanda.kafka_max_request_size=104857600
```
This command starts a single Redpanda broker and makes it available on `localhost:9092`.

### 2. Triggering a WhatsApp Broadcast

1.  **Ensure Redpanda is running** (from Step 1).
2.  **Start the application** (`npm run dev` for development, or `npm run start:pm2` for production).
3.  **Queue a Broadcast**: Go to the SabNode dashboard, navigate to "Campaigns", and create a new broadcast campaign by selecting a template and uploading a contact list.
4.  **Trigger the Cron Job**: The system uses a cron job to find queued broadcasts and push them to the Kafka `messages` topic. In production, this happens automatically. In development, you must trigger it manually by opening this URL in your browser:
    ```
    http://localhost:3001/api/cron/send-broadcasts
    ```
5.  **Monitor the Output**:
    *   **In Production**: Check the worker logs with `pm2 logs sabnode-worker`. You will see logs from the workers as they pick up and process the message batches from Kafka.
    *   **In Development**: Check the terminal where you are running `npm run dev`.

---
That's it! Your SabNode application is now fully configured for development and production, including the high-performance broadcasting system.
