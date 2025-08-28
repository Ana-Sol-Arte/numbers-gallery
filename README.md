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