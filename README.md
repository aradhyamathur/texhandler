# TeXHandler - Web-based LaTeX Editor

A web-based alternative to Overleaf for editing and compiling LaTeX documents.

## Features

- **File Upload**: Upload ZIP files containing LaTeX projects
- **Directory Support**: Open local directories directly
- **File Explorer**: Side panel with file tree navigation
- **Code Editor**: Syntax-highlighted editor with LaTeX support
- **PDF Preview**: Real-time PDF rendering after compilation
- **Auto-compilation**: Compile LaTeX documents with one click

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure you have a LaTeX distribution installed (e.g., TeX Live):
```bash
# On Ubuntu/Debian
sudo apt-get install texlive-full

# On macOS
brew install --cask mactex
```

## Usage

1. Start the server:
```bash
python app.py
```

2. Open your browser and navigate to:
```
http://localhost:5000
```

3. Upload a ZIP file or open a directory containing LaTeX files

4. Select files from the side panel to edit

5. Click "Compile" to generate the PDF

6. View the compiled PDF in the right panel

## Project Structure

```
texhandler/
├── app.py              # Flask backend
├── templates/
│   └── index.html      # Main frontend
├── static/
│   ├── css/
│   │   └── style.css   # Styles
│   └── js/
│       └── app.js      # Frontend logic
├── projects/           # Uploaded projects (created automatically)
└── requirements.txt    # Python dependencies
```

## API Endpoints

- `GET /` - Main page
- `POST /api/upload` - Upload ZIP file
- `POST /api/open_directory` - Open local directory
- `GET /api/projects` - List all projects
- `GET /api/files/<project_name>` - Get file tree
- `GET /api/file/<project_name>/<path>` - Get file content
- `PUT /api/file/<project_name>/<path>` - Save file
- `GET /api/compile/<project_name>` - Compile LaTeX
- `GET /api/pdf/<project_name>/<path>` - Get PDF file

## Keyboard Shortcuts

- `Ctrl+S` (or `Cmd+S` on Mac) - Save current file

## Notes

- Projects are stored in the `projects/` directory
- The application automatically finds the main `.tex` file (containing `\documentclass`)
- PDF compilation runs `pdflatex` twice to resolve references

