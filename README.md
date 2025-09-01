# 📚 Numbers Gallery – My VSC Notes

This repo holds my p5.js sketches and gallery for the **Numbers Project**.  
Here are my step-by-step instructions so I don’t forget how to work in VS Code and GitHub.

---

## 🖥️ Workflow: Editing & Viewing Sketches
1. Open this repo in VS Code.
2. Make/edit sketches in the `sketch.js` files inside each project folder.
3. Name the new sketch and add two folders inside it
      1. sketch.js - add all the code here
      2. index.html
4. To view in the browser:
    - Right-click `index.html`
    - Choose **"Open with Live Server"**
    - A browser window will open showing the sketch.

---

## 🌐 GitHub Workflow: Saving to the Cloud
1. After editing, open **Source Control** in VS Code.
2. Stage files (click the `+`).
3. Write a commit message (e.g., `update Zen particles sketch`).
4. Click ✔ **Commit**.
5. Then click **Sync Changes / Push** to upload to GitHub.

## Step 5: Commit & Push to GitHub
1. Save your file
2. Press ⌘ + S (Command + S) in VS Code to save sketches.json.
3. Open the Source Control panel
4. In VS Code’s left sidebar, click the branch icon (looks like three dots with lines, or sometimes a Y-shaped symbol).
5. Stage your changes
6. You should see sketches.json listed under “Changes.”
7. Hover over it and click the little ➕ (plus) sign.
8. Now it will move to Staged Changes.
9. Write a commit message
10. At the top of the Source Control panel, there’s a box that says “Message.”
11. Type something short and clear, e.g.: Update sketches.json with new sketch
12. Commit your changes
13. Click the ✔ (checkmark) button above the message box.
14. Now your changes are saved as a commit locally.
15. Push to GitHub
16. After committing, look for a button that says “Sync Changes” or “Push” in the Source Control panel.
17. Click it → this uploads your commit to GitHub.

---

## ➕ Adding a New Sketch to the Gallery
1. Create a new folder, e.g. `003-zen-particles`.
2. Add files: `index.html`, `style.css`, `sketch.js`.
3. Test locally with Live Server.
4. Edit `sketches.json` to include the new sketch:
    ```json
    { "slug": "003-zen-particles", "title": "Zen Particles ✨", "note": "Particles + Numbers" }
    ```
5. Save and commit your changes as above.

---

## 📝 Tips
- Use descriptive commit messages.
- Keep sketches organized by folder and number.
- Preview changes before pushing to GitHub.

---