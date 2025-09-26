<<<<<<< HEAD
# SabNode

This is SabNode, a platform to streamline your business communications and build your online presence. This platform includes modules for the WhatsApp Business API, Facebook Pages, and a Landing Page & Portfolio Builder.

## 🚀 Getting Started

### 1. Environment Variables

To run the application, you need to set up your environment variables. Create a file named `.env.local` in the root of your project and add the following variables.

**Do not commit this file to version control.**

```
# SabNode Core Configuration
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=your_mongodb_database_name
JWT_SECRET=a_long_random_secure_string_for_sessions

# Meta/Facebook Integration (Required for Facebook & WhatsApp)
# Get these from your Meta for Developers App Dashboard
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
NEXT_PUBLIC_META_CONFIG_ID=your_facebook_login_config_id

# This must be your publicly accessible application URL
NEXT_PUBLIC_APP_URL=https://your-app-domain.com

# Meta Webhooks (for receiving messages and updates)
# A random, secure string you will also enter in your Meta App settings.
META_VERIFY_TOKEN=a_random_secure_string_for_webhooks

# Optional: System User Token for admin actions like syncing projects
# META_SYSTEM_USER_ACCESS_TOKEN=your_permanent_system_user_token

# Google AI for Genkit Features
GOOGLE_API_KEY=your_google_ai_api_key

# Admin Login Credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_admin_password
```

### What is `NEXT_PUBLIC_META_CONFIG_ID`?

The `NEXT_PUBLIC_META_CONFIG_ID` is a unique identifier for a **"Facebook Login for Business"** configuration within your Meta App. This configuration allows for the streamlined, one-click "guided setup" experience in SabNode, where users can connect their accounts through a secure Facebook pop-up.

#### How to get it:

1.  Go to the **[Meta for Developers](https://developers.facebook.com/)** dashboard.
2.  Select your App.
3.  From the sidebar, find the **"Facebook Login"** product. You may need to add it first if it's not already there.
4.  Inside the Facebook Login settings, click on **"For Business"**.
5.  Here, you can create a new configuration or edit an existing one. In this configuration, you will define the permissions SabNode will request, such as `whatsapp_business_management` and `catalog_management`.
6.  Once you save your configuration, Meta will provide you with a **Configuration ID**. This is the value you need to put in your `.env.local` file for `NEXT_PUBLIC_META_CONFIG_ID`.

### 2. Run the Application

Once your `.env.local` file is configured, you can run the application:

```bash
npm install
npm run dev
```

## Setting up Webhooks

You need to create a Meta App and add the Webhooks product. 
Configure a webhook URL in your Meta App's settings to receive notifications. The URL will be `[YOUR_APP_URL]/api/webhooks/meta`.
Subscribe your app to your WhatsApp Business Account (WABA). 
You'll receive webhook notifications for various events, including changes to your WABA, phone numbers, message templates, and messages sent to your phone numbers.
=======
# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.
>>>>>>> 253f92ef (Initialized workspace with Firebase Studio)
