# 📋 RentSafe - Human Action Required Checklist

This checklist outlines the manual steps required to prepare the final submission, as they require your browser access, local wallet integration, or GitHub media uploads.

---

## 🚀 1. Live Frontend Deployment (Vercel / Netlify)
You need to host the React/Next.js frontend so the judges can interact with it.
1. **Sign Up/Log In** to [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
2. **Import the repository**: Link it to your GitHub repository for the project.
3. **Configure Environment Variables**: Add the following keys under the Build & Environment settings:
   - `NEXT_PUBLIC_ESCROW_CONTRACT_ID` = `CDDJ6HY5DJWMZCNC6BYHGUIG6Z4YKS3FJF56BGU66VXMHCMXQGUJFI36`
   - `NEXT_PUBLIC_DISPUTE_CONTRACT_ID` = `CAMZCYQF4DTCGIU3X637ZHDIUEWZBZGY7LNKJUPDCWUBIFS777KNKAZC`
   - `NEXT_PUBLIC_TOKEN_SAC` = `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
   - `NEXT_PUBLIC_SOROBAN_RPC_URL` = `https://soroban-testnet.stellar.org`
   - `NEXT_PUBLIC_NETWORK_PASSPHRASE` = `Test Stellar Public Network ; September 2015`
4. **Deploy**: Trigger the deploy pipeline. Copy the resulting **Live Link** (e.g. `https://rentsafe.vercel.app`) and replace the `[LIVE_DEMO_LINK]` placeholder at the very top of `README.md`.

---

## 📹 2. Record 1–2 Minutes Demo Video
Prepare a brief screenshare demonstration showcasing the app flow.
1. **Record the flow**:
   - Open the web app.
   - Connect Freighter wallet.
   - Create a Rental Escrow Agreement (Landlord view).
   - Deposit XLM (Tenant view).
   - Complete/settle the escrow.
2. **Upload**: Save it to Google Drive (set link access to "Anyone with the link") or upload to YouTube (unlisted or public).
3. **Update Link**: Replace the `[DEMO_VIDEO_LINK]` placeholder at the very top of `README.md` with your link.

---

## 📸 3. Capture & Upload Screenshots
The submission requires visual proof. Capture the screenshots, upload them to your GitHub repository (you can drag & drop them into a GitHub Issue comment to generate static URLs), and replace the corresponding image tags in the `README.md`.

### 3.1 Mobile Responsive UI
- **Action**: Open the app, right-click, select "Inspect", choose a mobile layout (e.g. iPhone SE/Pro), capture and save.
- **Placeholder to Replace**: Under `## 📸 Screenshots` ➔ `### Mobile Responsive UI` in `README.md`.

### 3.2 Desktop UI & Wallet Connected State
- **Action**: Capture the full page landing and dashboard with Freighter wallet successfully connected.
- **Placeholder to Replace**: Under `### Desktop UI` and `### Wallet Connected State` in `README.md`.

### 3.3 CI/CD Pipeline Running
- **Action**: Go to your GitHub repository ➔ Click on the **Actions** tab ➔ Screenshot the completed run of the **Build & Test Soroban Contracts** and **Lint & Test Next.js DApp** pipelines.
- **Placeholder to Replace**: Under `### CI/CD Pipeline Running` in `README.md`.

### 3.4 Test Output
- **Action**: Take a screenshot of the passing test outputs.
  - Rust tests: Run `cargo test` in terminal and capture the outputs.
  - Vitest tests: Run `npm run test` inside the `/frontend` directory and capture the outputs.
- **Placeholder to Replace**: Under `### Test Output` in `README.md`.

---

## 🐙 4. Create Git Repository & Push Commits
The agent has staged and committed the code in 11 progressive, meaningful stages to meet the "10+ meaningful commits" requirement. You just need to push it to your remote GitHub repository:
1. **Create repository**: Go to [GitHub](https://github.com) and create a new **public** repository named `RentSafe`.
2. **Link and push**: Run the following commands in your local workspace terminal:
   ```bash
   git remote add origin <your_github_repo_url>
   git branch -M main
   git push -u origin main
   ```
