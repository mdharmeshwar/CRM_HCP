# Step-by-Step Railway Deployment Guide

This project contains a multi-stage `Dockerfile` which automatically builds the React frontend and runs the FastAPI backend together.

## Step 1: Push Code to GitHub
1. Commit all your changes (including the new [Dockerfile](file:///d:/prodesk/crm/Dockerfile)).
2. Push your repository to GitHub.

## Step 2: Set Up Railway Project
1. Log in to [Railway.app](https://railway.app).
2. Click **New Project** → Select **Deploy from GitHub repo**.
3. Choose your repository. 
4. Select **Deploy Now** (it will temporarily fail or build; we will configure the database next).

## Step 3: Add MySQL Database
1. Inside your Railway project dashboard, click **+ Add** (or **+ New**).
2. Choose **Database** → **MySQL**.
3. Railway will provision a live MySQL database instantly.

## Step 4: Link Database Variables
1. Click on your newly created **MySQL** service on Railway.
2. Go to the **Variables** tab and copy the connection details.
3. Click on your **Web Service** (the main app repo).
4. Go to the **Variables** tab and add:
   * `GROQ_API_KEY` = *[Your actual Groq API key]*
   * `GROQ_MODEL` = `gemma2-9b-it`
   * `MYSQL_HOST` = `${{MySQL.MYSQLHOST}}` *(Railway will auto-resolve this)*
   * `MYSQL_USER` = `${{MySQL.MYSQLUSER}}`
   * `MYSQL_PASSWORD` = `${{MySQL.MYSQLPASSWORD}}`
   * `MYSQL_DATABASE` = `${{MySQL.MYSQLDATABASE}}`
   * `MYSQL_PORT` = `${{MySQL.MYSQLPORT}}`

## Step 5: Expose Public URL
1. Go to your **Web Service** → **Settings** tab.
2. Under **Networking**, click **Generate Domain** (or add your custom domain).
3. Railway will rebuild the project and deploy it at a public HTTPS URL.
