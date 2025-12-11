# The Hallucinated Truth

A game that evolved from looking into learning [Temporal](https://temporal.io/) for a job application.

This README explains how to install, configure, and run the entire stack locally using Docker.

## 💡 About the Game — Where “The Hallucinated Truth” Came From

The Hallucinated Truth is inspired by the BBC radio comedy panel show [“The Unbelievable Truth”](https://en.wikipedia.org/wiki/The_Unbelievable_Truth_(radio_show)).
In that show, a contestant delivers a story on a given topic where nearly everything is nonsense...apart from a few true statements which are hidden inside.
The other players must spot and call out the truths buried within the lies.

I thought it would be fun to recreate this format using an LLM.

Large Language Models hallucinate all the time, so instead of avoiding that behaviour, this game leans into it.
The agent generates a story filled with believable and unbelievable nonsense, hides real facts inside it, and your task is to uncover the truths.

This project is a blend of [Temporal](https://temporal.io/), [LangChain](https://www.langchain.com/), [Ollama](https://ollama.com/), [Custom Google Search API](https://developers.google.com/custom-search/v1/introduction), some Javascript and a handful of overly verbose prompts to let an LLM play a variant of “The Unbelievable Truth” against you.

---

## Table of Contents

1. Overview  
2. Prerequisites  
3. Create Google Custom Search Credentials  
    - Create or Log Into Google Developer Console  
    - Create a New Project  
    - Enable the Custom Search API  
    - Create an API Key  
    - Create a Programmable Search Engine (CSE)  
4. Install and Run Temporal  
5. Clone This Repository and Configure Environment Variables  
6. Start the Application  
7. Troubleshooting  

---

## Overview

This project bundles:

- A **Temporal workflow** controlling the game logic  
- A **LangChain agent** using `llama3:latest` for reasoning  
- An **Ollama server** to run the model locally  
- A **Google Custom Search** integration for grounded facts  
- An **NGINX web interface**  
- An optional **Open WebUI** for interacting with Ollama directly  

The result is a playable “truth-finding” game where the LLM makes statements, you interrogate them, and Temporal orchestrates the entire back-and-forth.

---

## Prerequisites

You will need:

- Docker Desktop  
- Git  
- A Google Developer Console account  
- macOS, Linux, or Windows with WSL2  

### ⚠️ Performance Notice for macOS (M-Series Recommended)

Running Ollama **inside Docker** is significantly slower on macOS because virtualization prevents Metal acceleration.  
For an M1/M2/M3 Mac, you must increase Docker’s resource allocation if you keep Ollama in Docker.

Recommended Docker Desktop settings (for a 64 GB M3 MacBook Pro):

- CPU: **12 cores**  
- Memory: **48 GB**  
- Swap: **2 GB**  
- Disk image size: **200+ GB**  
- Resource Saver: Disable or set a long timeout  
- Virtualization Framework: Default (Apple Virtualization)

If you want far better performance, you should run **Ollama natively**, not inside a container.  
A full section below explains how to do this.
---

## 1. Create Google Custom Search Credentials

This app uses Google’s **Custom Search API**. Google provides **100 free searches per day**, so you can test without enabling billing.

You will obtain two values:

- `GOOGLE_API_KEY`  
- `GOOGLE_CSE_ID`  

These will be added to a `.env` file later.

---

### 1.1 Create or Log Into Google Developer Console

Go to:

    https://console.developers.google.com/

If you don’t already have an account, create one.  
You do **not** need to add billing details just to test this project.

---

### 1.2 Create a New Project

If you already have several projects, it’s cleaner to make a new one:

1. Click the project selector at the top of the page.  
2. Choose **New Project**.  
3. Give it a name (for example: `llama-agent-search`).  
4. Click **Create**.

If this is your first time in Google Developer Console, Google may automatically create a default project such as **My First Project**.

---

### 1.3 Enable the Custom Search API

1. In the top search bar, type:

       Custom Search API

2. Click the result named **Custom Search API**.  
3. Click the **Enable** button.

If this is your first time, enabling the API may also create your first project automatically.

---

### 1.4 Create an API Key (GOOGLE_API_KEY)

1. In the left sidebar, click **Credentials**.  
2. At the top, click **+ Create Credentials**.  
3. Select **API key**.  
4. A sidebar appears showing your new key.

Now restrict it:

1. In the sidebar, find **API restrictions**.  
2. Select **Restrict key**.  
3. Choose **Custom Search API** from the dropdown.  
4. Save your changes.

Copy the generated key – this is your:

    GOOGLE_API_KEY

Keep it somewhere safe and do **not** commit it to GitHub.

---

### 1.5 Create a Programmable Search Engine (GOOGLE_CSE_ID)

Now create the Programmable Search Engine that will back the Custom Search API:

1. Go to:

       https://programmablesearchengine.google.com/

2. Click **Add**.  
3. Give your search engine a name.  
4. Configure it so it can search the **entire web**.  
5. Click **Create**.

You will then see an embed snippet that looks something like:

    <script async src="https://cse.google.com/cse.js?cx=123abc456:def789ghi"></script>

Copy only the value after `cx=`. That is your:

    GOOGLE_CSE_ID

You now have both values required for the `.env` file.

---

## 2. Install and Run Temporal

Temporal orchestrates the long-running game workflows. The easiest way to run it locally is by using the official Temporal Docker Compose setup.

Clone the Temporal Docker Compose repository into a suitable folder (for example, wherever you keep your Docker-related projects):

    git clone https://github.com/temporalio/docker-compose.git ./temporal

Move into the new directory:

    cd temporal

Start Temporal with Docker Compose:

    docker compose up -d

Docker will pull all required Temporal images and start them in the background.

To confirm it’s running, open a browser and go to:

    http://localhost:8080/

If you see the Temporal Web UI, your Temporal backend is up and ready.

---

## 3. Clone This Repository and Configure Environment Variables

Next, clone the game and agent code itself. From the root of your Docker projects folder (or wherever you prefer to keep this project), run:

    git clone https://github.com/rilhia/the-hallucinated-truth.git ./the-hallucinated-truth

This will create a folder named:

    the-hallucinated-truth

and clone everything needed to run the game, **except** the `.env` file.

Move into the project directory:

    cd the-hallucinated-truth

You can verify with:

    pwd

Now create the `.env` file and insert the Google credentials you created earlier:

    cat > .env <<'EOF'
    GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxx
    GOOGLE_CSE_ID=xxxxxxxxxxxxxxxxxxxxxxxx
    EOF

Replace the `x` values with your actual `GOOGLE_API_KEY` and `GOOGLE_CSE_ID`.

Important:

- Do **not** commit `.env` to GitHub.
- Make sure `.gitignore` is configured to exclude `.env`.

At this point, the project is configured with the Google credentials it needs.

---

## 4. Start the Application

Make sure Temporal is still running (it will be unless you stopped the containers manually).

From the root of the `the-hallucinated-truth` folder, start the full stack:

    docker compose up -d

On the first run, this may take a while. Docker will:

- Pull **Node** (backend app)  
- Pull **nginx:alpine** (front-end gateway / reverse proxy)  
- Pull **Ollama** (local LLM runtime)  
- Pull **Open WebUI** (browser-based UI for Ollama)  
- Pull the **`llama3:latest`** model for Ollama  

Once everything is pulled and started, the app’s web interface will be available at:

    http://localhost:8085/

Open that URL in your browser to access **The Hallucinated Truth**.

---

## 5. Optional: Running Ollama Natively for Better Performance (Highly Recommended)

### Why Native Ollama Is Faster

Ollama inside Docker runs under Linux virtualization and **cannot access Apple Metal acceleration**.  
Native Ollama uses:

- Direct CPU/GPU access  
- Metal acceleration  
- No virtualization overhead  

This produces **2–6× faster inference** on M-series Macs.

### Step 1 — Install Ollama Natively

Download for macOS:

https://ollama.com/download/mac

Install and verify:

    ollama –version

Start the server:

    ollama serve

Pull the model:

    ollama pull llama3:latest

Native Ollama listens on:

    http://localhost:11434

### Step 2 — Remove Ollama Container From Docker Compose

Remove or comment out the `ollama:` service:

    ollama:
      image: ollama/ollama:latest
      container_name: hallucinated_ollama
      ports:
        - "11434:11434"
      volumes:
        - ollama_data:/root/.ollama
      restart: unless-stopped
      entrypoint: ["/bin/sh", "-c"]
      command: |
        "
        # Start Ollama in background
        ollama serve &

        # Wait for API to come up
        sleep 3

        echo 'Pulling Llama 3 8B...'
        ollama pull llama3:latest

        # Keep container alive
        wait
        "
      networks:
        - webnet

### Step 3 — Restart Everything

    docker compose down
    docker compose up -d

Ensure native Ollama is running:
    
    ollama serve

### Summary

| Mode | Speed | GPU | Notes |
|------|-------|-----|-------|
| Dockerised Ollama | Slowest | No GPU | Easiest setup |
| Native Ollama | Fastest | Uses GPU  | Recommended for all M-series Mac users |

---

## 5. Using the App (High-Level)

Once the app is running:

- The **frontend** runs on `http://localhost:8085/`.  
- **Temporal** is accessible at `http://localhost:8080/` to inspect workflows, task queues, and history.  
- **Ollama** runs locally and serves the `llama3:latest` model used by the agent.  
- The app calls Google Custom Search via your configured key and CSE ID to ground its reasoning in real data.

Depending on how the UI is implemented in this repository, you may see:

- A way to start a new game session.  
- Some controls to ask questions, reveal truths, or challenge claims.  
- (Optionally) links to debug or observe the Temporal workflows.

---

## Troubleshooting

### Temporal UI doesn’t load

- Check that Docker Desktop is running.  
- Restart the Temporal stack:

      cd temporal
      docker compose up -d

- Confirm again at:

      http://localhost:8080/

---

### `llama3:latest` model not available

If downloading the model via the stack fails, you can try pulling it manually with Ollama (if you have Ollama installed locally):

    ollama pull llama3:latest

Then restart the app containers:

    cd the-hallucinated-truth
    docker compose up -d

---

### `.env` not being picked up

- Ensure that:

      .env

  exists in the root of `the-hallucinated-truth` (the same directory as `docker-compose.yml`).

- Make sure you ran:

      docker compose up -d

  from inside the `the-hallucinated-truth` directory.

---

### Ports already in use

If `8080` or `8085` are already in use:

- Stop the conflicting service, or  
- Update the `docker-compose.yml` file to map the services to different host ports, then restart:

      docker compose down
      docker compose up -d

---

## You’re Ready to Play

With all containers running:

- Temporal is orchestrating workflows.  
- Ollama is serving `llama3:latest`.  
- Google Custom Search is providing grounded web results.  
- The front-end is live at `http://localhost:8085/`.

You can now play **The Hallucinated Truth**, inspect Temporal workflows, and experiment with an LLM that has to justify its own “hallucinations” against real-world data.
