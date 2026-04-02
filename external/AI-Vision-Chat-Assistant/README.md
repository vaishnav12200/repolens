# 🤖 AI Vision Chat Assistant

Full-stack application for image recognition + contextual chat.

- **Backend:** Flask + TensorFlow MobileNetV2
- **Frontend:** React (Vite)
- **Key behavior:** Chat answers can use the **latest uploaded image context** (top predictions + confidence)

---

## ✨ Features

- 🖼️ **Image Recognition:** Upload an image and get model predictions.
- 📊 **Richer Model Output:** Uses multiple image views and returns top predictions with confidence scores.
- 💬 **Context-Aware Chat:** Chat uses the most recent image analysis to answer "what is in image", "confidence", "top predictions", etc.
- 🎨 **Modern UI:** Responsive React interface with image preview and chat-side context panel.

---

## 📁 Project Structure

```
AI-Vision-Chat-Assistant/
├── backend/
│   ├── app.py
│   ├── image_model.py
│   ├── chatbot.py
│   └── requirements.txt
└── frontend/
        └── client/
                ├── package.json
                ├── index.html
                ├── vite.config.js
                └── src/
                        ├── App.jsx
                        ├── api.js
                        ├── main.jsx
                        └── styles.css
```

---

## 🚀 Quick Start (Linux/macOS)

### 1) Create Python 3.11 virtual environment (project root)

```bash
python3.11 -m venv venv
source venv/bin/activate
```

### 2) Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3) Run backend

```bash
python app.py
```

Backend runs at `http://localhost:5000`.

### 4) Run frontend (new terminal)

```bash
cd frontend/client
npm install
npm run dev
```

Frontend dev server runs at Vite default URL (usually `http://localhost:5173`).

---

## ⚙️ Frontend Environment

Optional environment variable in `frontend/client/.env`:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

If not set, frontend defaults to `http://localhost:5000`.

---

## 📡 API

### `GET /health`

Health check.

**Response**

```json
{ "status": "healthy" }
```

### `POST /predict`

Upload image as `multipart/form-data` with key `image`.

**Response**

```json
{
    "prediction": "Likely tennis ball (27.4% confidence)",
    "image_context": {
        "filename": "sample.png",
        "filepath": "/tmp/ai_vision_uploads/image_xxx.png",
        "summary": "Likely tennis ball (27.4% confidence)",
        "primary_label": "tennis ball",
        "primary_confidence": 27.44,
        "top_predictions": [
            { "class_id": "n04409515", "label": "tennis ball", "confidence": 27.44 },
            { "class_id": "n07802026", "label": "hay", "confidence": 3.18 },
            { "class_id": "n02782093", "label": "balloon", "confidence": 2.52 }
        ]
    }
}
```

### `POST /chat`

Send JSON body:

```json
{ "message": "what is in my image?" }
```

**Response**

```json
{
    "reply": "From your latest upload: ...",
    "image_context": { "...": "latest prediction context" }
}
```

---

## 🔧 Troubleshooting

- If you see `ModuleNotFoundError: No module named 'flask'`, activate venv first: `source venv/bin/activate`.
- First TensorFlow startup may take time because model assets are loaded/downloaded.
- If `tensorflow==2.12.0` fails to install, use Python 3.11 for this project.

---

## 📌 Notes

- Chat context is based on the **latest** uploaded image for the running backend instance.
- Uploaded files are saved in a temporary system directory (`/tmp/ai_vision_uploads`).
