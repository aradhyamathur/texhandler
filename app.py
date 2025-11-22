from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import os
import zipfile
import shutil
import subprocess
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'projects')
ALLOWED_EXTENSIONS = {'zip'}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    return '', 204  # No content

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Create a project directory
        project_name = os.path.splitext(file.filename)[0]
        project_path = os.path.join(UPLOAD_FOLDER, project_name)
        
        # Remove existing project if it exists
        if os.path.exists(project_path):
            shutil.rmtree(project_path)
        
        os.makedirs(project_path, exist_ok=True)
        
        # Save zip file
        zip_path = os.path.join(project_path, file.filename)
        file.save(zip_path)
        
        # Extract zip file
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(project_path)
            os.remove(zip_path)  # Remove zip after extraction
            
            # Handle nested zip files
            def extract_nested_zips(directory):
                for root, dirs, files in os.walk(directory):
                    for file in files:
                        if file.endswith('.zip'):
                            nested_zip_path = os.path.join(root, file)
                            try:
                                with zipfile.ZipFile(nested_zip_path, 'r') as nested_zip:
                                    # Extract to the same directory as the zip
                                    extract_dir = os.path.dirname(nested_zip_path)
                                    nested_zip.extractall(extract_dir)
                                os.remove(nested_zip_path)  # Remove nested zip after extraction
                                # Recursively check for more nested zips
                                extract_nested_zips(extract_dir)
                            except Exception as e:
                                print(f"Warning: Could not extract nested zip {nested_zip_path}: {e}")
            
            extract_nested_zips(project_path)
            
            return jsonify({
                'success': True,
                'project_name': project_name,
                'message': 'File uploaded and extracted successfully'
            })
        except Exception as e:
            return jsonify({'error': f'Failed to extract zip: {str(e)}'}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/open_directory', methods=['POST'])
def open_directory():
    data = request.json
    directory_path = data.get('path', '')
    
    if not os.path.exists(directory_path) or not os.path.isdir(directory_path):
        return jsonify({'error': 'Invalid directory path'}), 400
    
    # Copy directory to projects folder
    project_name = os.path.basename(directory_path.rstrip('/'))
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if os.path.exists(project_path):
        shutil.rmtree(project_path)
    
    shutil.copytree(directory_path, project_path)
    
    return jsonify({
        'success': True,
        'project_name': project_name,
        'message': 'Directory opened successfully'
    })

@app.route('/api/projects')
def list_projects():
    projects = []
    if os.path.exists(UPLOAD_FOLDER):
        for item in os.listdir(UPLOAD_FOLDER):
            item_path = os.path.join(UPLOAD_FOLDER, item)
            if os.path.isdir(item_path):
                # Get project info
                size = sum(
                    os.path.getsize(os.path.join(dirpath, filename))
                    for dirpath, dirnames, filenames in os.walk(item_path)
                    for filename in filenames
                )
                modified_time = os.path.getmtime(item_path)
                projects.append({
                    'name': item,
                    'size': size,
                    'modified': modified_time
                })
    return jsonify({'projects': projects})

@app.route('/api/projects/<project_name>', methods=['DELETE'])
def delete_project(project_name):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if not os.path.exists(project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    try:
        shutil.rmtree(project_path)
        return jsonify({
            'success': True,
            'message': 'Project deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete project: {str(e)}'}), 500

@app.route('/api/projects/<project_name>', methods=['PUT'])
def rename_project(project_name):
    data = request.json
    new_name = data.get('name', '').strip()
    
    if not new_name:
        return jsonify({'error': 'New project name is required'}), 400
    
    # Validate new project name
    if '/' in new_name or '\\' in new_name or '..' in new_name:
        return jsonify({'error': 'Invalid project name'}), 400
    
    old_project_path = os.path.join(UPLOAD_FOLDER, project_name)
    new_project_path = os.path.join(UPLOAD_FOLDER, new_name)
    
    if not os.path.exists(old_project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    if os.path.exists(new_project_path):
        return jsonify({'error': 'A project with that name already exists'}), 400
    
    try:
        shutil.move(old_project_path, new_project_path)
        return jsonify({
            'success': True,
            'project_name': new_name,
            'message': 'Project renamed successfully'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to rename project: {str(e)}'}), 500

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    project_name = data.get('name', '').strip()
    
    if not project_name:
        return jsonify({'error': 'Project name is required'}), 400
    
    # Validate project name (no path traversal, no special chars)
    if '/' in project_name or '\\' in project_name or '..' in project_name:
        return jsonify({'error': 'Invalid project name'}), 400
    
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if os.path.exists(project_path):
        return jsonify({'error': 'Project already exists'}), 400
    
    try:
        os.makedirs(project_path, exist_ok=True)
        # Create a basic main.tex file
        main_tex_path = os.path.join(project_path, 'main.tex')
        with open(main_tex_path, 'w', encoding='utf-8') as f:
            f.write('\\documentclass{article}\n')
            f.write('\\begin{document}\n')
            f.write('Hello, World!\n')
            f.write('\\end{document}\n')
        
        return jsonify({
            'success': True,
            'project_name': project_name,
            'message': 'Project created successfully'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to create project: {str(e)}'}), 500

@app.route('/api/files/<project_name>')
def list_files(project_name):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if not os.path.exists(project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    def get_file_tree(path, base_path):
        tree = []
        try:
            for item in sorted(os.listdir(path)):
                item_path = os.path.join(path, item)
                rel_path = os.path.relpath(item_path, base_path)
                
                if os.path.isdir(item_path):
                    tree.append({
                        'name': item,
                        'path': rel_path,
                        'type': 'directory',
                        'children': get_file_tree(item_path, base_path)
                    })
                else:
                    tree.append({
                        'name': item,
                        'path': rel_path,
                        'type': 'file',
                        'size': os.path.getsize(item_path)
                    })
        except PermissionError:
            pass
        return tree
    
    file_tree = get_file_tree(project_path, project_path)
    return jsonify({'files': file_tree})


@app.route('/api/file/<project_name>/<path:file_path>', methods=['PUT'])
def save_file(project_name, file_path):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    full_path = os.path.join(project_path, file_path)
    
    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(project_path)):
        return jsonify({'error': 'Invalid path'}), 400
    
    data = request.json
    content = data.get('content', '')
    
    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload_file/<project_name>', methods=['POST'])
def upload_file_to_project(project_name):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    if not os.path.exists(project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    # Get target directory from request
    target_dir = request.form.get('directory', '')
    if target_dir:
        target_path = os.path.join(project_path, target_dir)
        # Security check
        if not os.path.abspath(target_path).startswith(os.path.abspath(project_path)):
            return jsonify({'error': 'Invalid directory path'}), 400
        if not os.path.isdir(target_path):
            return jsonify({'error': 'Target is not a directory'}), 400
    else:
        target_path = project_path
    
    try:
        file_path = os.path.join(target_path, file.filename)
        file.save(file_path)
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'path': os.path.relpath(file_path, project_path)
        })
    except Exception as e:
        return jsonify({'error': f'Failed to upload file: {str(e)}'}), 500

@app.route('/api/file/<project_name>/<path:file_path>', methods=['GET'])
def get_file_or_image(project_name, file_path):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    full_path = os.path.join(project_path, file_path)
    
    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(project_path)):
        return jsonify({'error': 'Invalid path'}), 400
    
    if not os.path.exists(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    if os.path.isdir(full_path):
        return jsonify({'error': 'Path is a directory'}), 400
    
    # Check if it's an image
    image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'}
    file_ext = os.path.splitext(full_path)[1].lower()
    
    if file_ext in image_extensions:
        return send_file(full_path)
    
    # Otherwise, try to read as text
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({
            'content': content,
            'path': file_path,
            'type': 'text'
        })
    except UnicodeDecodeError:
        return jsonify({'error': 'File is not a text file'}), 400

@app.route('/api/tex_files/<project_name>')
@app.route('/api/projects/<project_name>/tex_files')
def list_tex_files(project_name):
    """List all .tex files in a project"""
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if not os.path.exists(project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    tex_files = []
    for root, dirs, files in os.walk(project_path):
        for file in files:
            if file.endswith('.tex'):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, project_path)
                # Check if it's a main file (has \documentclass)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        is_main = '\\documentclass' in content
                except:
                    is_main = False
                
                tex_files.append({
                    'path': rel_path,
                    'name': file,
                    'is_main': is_main
                })
    
    # Sort: main files first, then by name
    tex_files.sort(key=lambda x: (not x['is_main'], x['name']))
    
    return jsonify({'tex_files': tex_files})

@app.route('/api/clean/<project_name>', methods=['POST', 'GET'])
def clean_project(project_name):
    """Remove all compilation-generated files"""
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if not os.path.exists(project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    # List of file extensions to remove (auxiliary files, not PDFs)
    extensions_to_remove = [
        '.aux', '.log', '.out', '.toc', '.lof', '.lot', '.fls', '.fdb_latexmk',
        '.synctex.gz', '.bbl', '.blg', '.bcf', '.run.xml', '.nav', '.snm',
        '.vrb', '.idx', '.ilg', '.ind', '.glo', '.gls', '.glg', '.acn', '.acr',
        '.alg', '.loa', '.thm', '.figlist', '.makefile', '.xdv', '.dvi'
    ]
    
    removed_files = []
    errors = []
    
    try:
        for root, dirs, files in os.walk(project_path):
            # Skip hidden directories
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            for file in files:
                # Skip hidden files
                if file.startswith('.'):
                    continue
                
                file_path = os.path.join(root, file)
                file_ext = os.path.splitext(file)[1].lower()
                
                # Don't remove PDF files
                if file_ext == '.pdf':
                    continue
                
                # Check for .synctex.gz files first (double extension)
                if file.endswith('.synctex.gz'):
                    try:
                        os.remove(file_path)
                        removed_files.append(os.path.relpath(file_path, project_path))
                    except Exception as e:
                        errors.append(f"Failed to remove {file}: {str(e)}")
                    continue
                
                # Remove files with matching extensions
                if file_ext in extensions_to_remove:
                    try:
                        os.remove(file_path)
                        removed_files.append(os.path.relpath(file_path, project_path))
                    except Exception as e:
                        errors.append(f"Failed to remove {file}: {str(e)}")
                
                # Also remove .synctex files (without .gz extension)
                elif file.endswith('.synctex'):
                    try:
                        os.remove(file_path)
                        removed_files.append(os.path.relpath(file_path, project_path))
                    except Exception as e:
                        errors.append(f"Failed to remove {file}: {str(e)}")
        
        return jsonify({
            'success': True,
            'removed_files': removed_files,
            'count': len(removed_files),
            'errors': errors if errors else None
        })
    except Exception as e:
        return jsonify({'error': f'Failed to clean project: {str(e)}'}), 500

@app.route('/api/compile/<project_name>')
def compile_latex(project_name):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if not os.path.exists(project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    # Get file to compile from query parameter or request body
    compile_file = request.args.get('file')
    if not compile_file and request.is_json:
        compile_file = request.json.get('file')
    
    if compile_file:
        # Use specified file - handle both relative and absolute paths
        if os.path.isabs(compile_file):
            # If absolute, ensure it's within project_path
            if not compile_file.startswith(os.path.abspath(project_path)):
                return jsonify({'error': 'Invalid file path'}), 400
            main_file = compile_file
        else:
            # Relative path - join with project_path
            main_file = os.path.join(project_path, compile_file)
        
        # Security check
        if not os.path.abspath(main_file).startswith(os.path.abspath(project_path)):
            return jsonify({'error': 'Invalid file path'}), 400
        if not os.path.exists(main_file):
            return jsonify({'error': f'Specified file not found: {compile_file} (resolved to: {main_file})'}), 404
        if not main_file.endswith('.tex'):
            return jsonify({'error': 'File must be a .tex file'}), 400
    else:
        # Find main LaTeX file automatically
        main_file = None
        for root, dirs, files in os.walk(project_path):
            for file in files:
                if file.endswith('.tex'):
                    # Check if it might be the main file
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            if '\\documentclass' in content:
                                main_file = file_path
                                break
                    except:
                        continue
            if main_file:
                break
        
        if not main_file:
            return jsonify({'error': 'No main LaTeX file found'}), 404
    
    # Compile LaTeX
    compile_dir = os.path.dirname(main_file)
    main_filename = os.path.basename(main_file)
    base_name = os.path.splitext(main_filename)[0]
    
    try:
        compilation_log = []
        
        # Check source file for bibliography commands to determine which system to use
        needs_bibtex = False
        needs_biber = False
        
        try:
            with open(main_file, 'r', encoding='utf-8') as f:
                tex_content = f.read()
                # Check for biblatex (modern bibliography system)
                if '\\usepackage{biblatex}' in tex_content or '\\addbibresource' in tex_content:
                    needs_biber = True
                # Check for traditional bibtex
                elif '\\bibliography' in tex_content or '\\bibliographystyle' in tex_content:
                    needs_bibtex = True
        except:
            pass
        
        # First pdflatex pass - generates .aux file with reference information
        result1 = subprocess.run(
            ['pdflatex', '-synctex=1', '-interaction=nonstopmode', '-output-directory', compile_dir, '-jobname', base_name, main_filename],
            cwd=compile_dir,
            capture_output=True,
            text=True,
            timeout=60
        )
        compilation_log.append("=== First pdflatex pass ===\n" + result1.stdout + result1.stderr)
        
        # Double-check .aux file for citations (in case source file check missed something)
        aux_file = os.path.join(compile_dir, base_name + '.aux')
        if os.path.exists(aux_file):
            try:
                with open(aux_file, 'r', encoding='utf-8') as f:
                    aux_content = f.read()
                    # Check for bibliography commands in .aux
                    if '\\citation' in aux_content or '\\bibdata' in aux_content:
                        # Check which bibliography system is used
                        if '\\bibstyle' in aux_content or '\\bibliographystyle' in aux_content:
                            needs_bibtex = True
                        if '\\addbibresource' in aux_content or 'biblatex' in aux_content.lower():
                            needs_biber = True
            except:
                pass
        
        # Run bibliography processor if needed
        if needs_biber:
            try:
                result_biber = subprocess.run(
                    ['biber', base_name],
                    cwd=compile_dir,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                compilation_log.append("=== Biber pass ===\n" + result_biber.stdout + result_biber.stderr)
            except FileNotFoundError:
                compilation_log.append("=== Warning: biber not found, skipping bibliography processing ===\n")
            except Exception as e:
                compilation_log.append(f"=== Biber error: {str(e)} ===\n")
        elif needs_bibtex:
            try:
                result_bibtex = subprocess.run(
                    ['bibtex', base_name],
                    cwd=compile_dir,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                compilation_log.append("=== BibTeX pass ===\n" + result_bibtex.stdout + result_bibtex.stderr)
            except FileNotFoundError:
                compilation_log.append("=== Warning: bibtex not found, skipping bibliography processing ===\n")
            except Exception as e:
                compilation_log.append(f"=== BibTeX error: {str(e)} ===\n")
        
        # Second pdflatex pass - reads .aux and resolves references
        result2 = subprocess.run(
            ['pdflatex', '-synctex=1', '-interaction=nonstopmode', '-output-directory', compile_dir, '-jobname', base_name, main_filename],
            cwd=compile_dir,
            capture_output=True,
            text=True,
            timeout=60
        )
        compilation_log.append("=== Second pdflatex pass ===\n" + result2.stdout + result2.stderr)
        
        # Check if there are unresolved references that need another pass
        needs_third_pass = needs_bibtex or needs_biber
        if not needs_third_pass and os.path.exists(aux_file):
            try:
                with open(aux_file, 'r', encoding='utf-8') as f:
                    aux_content = f.read()
                    # Check for unresolved references (LaTeX will mention these in the log)
                    if 'Rerun' in result2.stdout or 'Rerun' in result2.stderr:
                        needs_third_pass = True
            except:
                pass
        
        # Third pdflatex pass - finalizes all references
        if needs_third_pass:
            result3 = subprocess.run(
                ['pdflatex', '-synctex=1', '-interaction=nonstopmode', '-output-directory', compile_dir, '-jobname', base_name, main_filename],
                cwd=compile_dir,
                capture_output=True,
                text=True,
                timeout=60
            )
            compilation_log.append("=== Third pdflatex pass ===\n" + result3.stdout + result3.stderr)
        
        pdf_path = os.path.join(compile_dir, base_name + '.pdf')
        synctex_path = os.path.join(compile_dir, base_name + '.synctex.gz')
        
        # Combine all logs
        full_log = '\n'.join(compilation_log)
        
        if os.path.exists(pdf_path):
            return jsonify({
                'success': True,
                'pdf_path': os.path.relpath(pdf_path, project_path),
                'synctex_path': os.path.relpath(synctex_path, project_path) if os.path.exists(synctex_path) else None,
                'log': full_log
            })
        else:
            return jsonify({
                'success': False,
                'error': 'PDF generation failed',
                'log': full_log
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Compilation timeout'}), 500
    except FileNotFoundError:
        return jsonify({'error': 'pdflatex not found. Please install LaTeX distribution.'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pdf/<project_name>/<path:pdf_path>')
def get_pdf(project_name, pdf_path):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    full_path = os.path.join(project_path, pdf_path)
    
    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(project_path)):
        return jsonify({'error': 'Invalid path'}), 400
    
    if not os.path.exists(full_path):
        return jsonify({'error': 'PDF not found'}), 404
    
    return send_file(full_path, mimetype='application/pdf')

@app.route('/api/synctex/<project_name>/<path:synctex_path>')
def get_synctex(project_name, synctex_path):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    full_path = os.path.join(project_path, synctex_path)
    
    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(project_path)):
        return jsonify({'error': 'Invalid path'}), 400
    
    if not os.path.exists(full_path):
        return jsonify({'error': 'SyncTeX file not found'}), 404
    
    return send_file(full_path, mimetype='application/gzip')

@app.route('/api/synctex/<project_name>/resolve', methods=['POST'])
def resolve_synctex(project_name, synctex_path=None):
    """Resolve PDF coordinates to source file and line number using synctex command"""
    import subprocess
    import tempfile
    
    data = request.json
    page = data.get('page', 1)
    x = data.get('x', 0)
    y = data.get('y', 0)
    
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    # Find synctex file and PDF file
    synctex_file = None
    pdf_file = None
    for root, dirs, files in os.walk(project_path):
        for file in files:
            if file.endswith('.synctex.gz') and synctex_file is None:
                synctex_file = os.path.join(root, file)
            if file.endswith('.pdf') and pdf_file is None:
                pdf_file = os.path.join(root, file)
        if synctex_file and pdf_file:
            break
    
    if not synctex_file or not os.path.exists(synctex_file):
        return jsonify({'error': 'SyncTeX file not found'}), 404
    
    if not pdf_file or not os.path.exists(pdf_file):
        return jsonify({'error': 'PDF file not found'}), 404
    
    try:
        # Use synctex command-line tool if available
        # Format: synctex edit -o <page>:<x>:<y>:<pdf> <synctex>
        try:
            result = subprocess.run(
                ['synctex', 'edit', '-o', f'{page}:{x}:{y}:{pdf_file}', synctex_file],
                cwd=project_path,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0 and result.stdout:
                # Parse output: Input:1:filename.tex
                # Line:123
                import re
                input_match = re.search(r'Input:(\d+):([^\n]+)', result.stdout)
                line_match = re.search(r'Line:(\d+)', result.stdout)
                
                if input_match and line_match:
                    input_num = int(input_match.group(1))
                    filename = input_match.group(2).strip()
                    line_num = int(line_match.group(1))
                    
                    # Find the actual file path
                    file_path = None
                    for root, dirs, files in os.walk(project_path):
                        if filename in files:
                            file_path = os.path.join(root, filename)
                            break
                        # Also check with just basename
                        if os.path.basename(filename) in files:
                            file_path = os.path.join(root, os.path.basename(filename))
                            break
                    
                    if file_path:
                        rel_path = os.path.relpath(file_path, project_path)
                        return jsonify({
                            'success': True,
                            'file': rel_path,
                            'line': line_num,
                            'column': 1
                        })
                    
                    # If not found by input number, search all .tex files
                    # This handles cases where the file is in a subdirectory
                    for root, dirs, files in os.walk(project_path):
                        for file in files:
                            if file.endswith('.tex'):
                                file_path = os.path.join(root, file)
                                rel_path = os.path.relpath(file_path, project_path)
                                # Try to match by checking if filename appears in synctex
                                if filename in file or os.path.basename(filename) == file:
                                    # Estimate line number from page (rough approximation)
                                    estimated_line = max(1, (page - 1) * 30)
                                    return jsonify({
                                        'success': True,
                                        'file': rel_path,
                                        'line': estimated_line,
                                        'column': 1
                                    })
        except FileNotFoundError:
            # synctex command not available, fall back to parsing
            pass
        except Exception as e:
            # Continue to fallback
            pass
        
        # Fallback: Parse synctex file manually
        import gzip
        import re
        
        with gzip.open(synctex_file, 'rt', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Find Input entries
        inputs = {}
        for match in re.finditer(r'Input:(\d+):([^\n]+)', content):
            input_num = int(match.group(1))
            filename = match.group(2).strip()
            inputs[input_num] = filename
        
        # Find the main tex file (usually Input:0 or Input:1)
        main_tex = None
        for num in sorted(inputs.keys()):
            if inputs[num].endswith('.tex'):
                main_tex = inputs[num]
                break
        
        if not main_tex:
            return jsonify({'error': 'Could not find main tex file in SyncTeX'}), 500
        
        # Find the actual file path
        main_tex_path = None
        for root, dirs, files in os.walk(project_path):
            if main_tex in files:
                main_tex_path = os.path.join(root, main_tex)
                break
            if os.path.basename(main_tex) in files:
                main_tex_path = os.path.join(root, os.path.basename(main_tex))
                break
        
        if main_tex_path:
            rel_path = os.path.relpath(main_tex_path, project_path)
            # Try to find a line number from the synctex content
            # Look for patterns that might indicate line numbers near the page
            line_num = 1
            # This is a simplified approach - full parser would be more complex
            return jsonify({
                'success': True,
                'file': rel_path,
                'line': line_num,
                'column': 1
            })
        else:
            return jsonify({'error': 'Source file not found'}), 404
            
    except Exception as e:
        return jsonify({'error': f'Failed to parse SyncTeX: {str(e)}'}), 500

@app.route('/api/synctex/<project_name>/resolve_reverse', methods=['POST'])
def resolve_synctex_reverse(project_name):
    """Resolve source file and line to PDF coordinates (for editor to PDF mapping)"""
    import subprocess
    
    data = request.json
    file_path = data.get('file')
    line = data.get('line', 1)
    column = data.get('column', 1)
    
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    # Find synctex file and PDF file
    synctex_file = None
    pdf_file = None
    for root, dirs, files in os.walk(project_path):
        for file in files:
            if file.endswith('.synctex.gz') and synctex_file is None:
                synctex_file = os.path.join(root, file)
            if file.endswith('.pdf') and pdf_file is None:
                pdf_file = os.path.join(root, file)
        if synctex_file and pdf_file:
            break
    
    if not synctex_file or not os.path.exists(synctex_file):
        return jsonify({'error': 'SyncTeX file not found'}), 404
    
    if not pdf_file or not os.path.exists(pdf_file):
        return jsonify({'error': 'PDF file not found'}), 404
    
    # Resolve file path
    full_file_path = os.path.join(project_path, file_path)
    if not os.path.exists(full_file_path):
        return jsonify({'error': 'Source file not found'}), 404
    
    try:
        # Use synctex command-line tool for reverse lookup
        # Format: synctex view -i <line>:<column>:<input_num>:<source_file> -o <pdf>
        try:
            # First, find the input number for this file
            import gzip
            import re
            
            with gzip.open(synctex_file, 'rt', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Find the input number for this file
            input_num = None
            filename = os.path.basename(full_file_path)
            for match in re.finditer(r'Input:(\d+):([^\n]+)', content):
                if filename in match.group(2) or match.group(2) in filename:
                    input_num = int(match.group(1))
                    break
            
            if input_num is None:
                input_num = 1  # Default
            
            # Use synctex view command
            result = subprocess.run(
                ['synctex', 'view', '-i', f'{line}:{column}:{input_num}:{full_file_path}', '-o', pdf_file],
                cwd=project_path,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0 and result.stdout:
                # Parse output: Page:1
                # x:123.45
                # y:678.90
                import re
                page_match = re.search(r'Page:(\d+)', result.stdout)
                x_match = re.search(r'x:([\d.]+)', result.stdout)
                y_match = re.search(r'y:([\d.]+)', result.stdout)
                
                if page_match and x_match and y_match:
                    return jsonify({
                        'success': True,
                        'page': int(page_match.group(1)),
                        'x': float(x_match.group(1)),
                        'y': float(y_match.group(1))
                    })
        except FileNotFoundError:
            # synctex command not available
            return jsonify({'error': 'synctex command not found. Please install TeX Live or MiKTeX.'}), 500
        except Exception as e:
            return jsonify({'error': f'Failed to resolve: {str(e)}'}), 500
        
        return jsonify({'error': 'Could not resolve coordinates'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to parse SyncTeX: {str(e)}'}), 500

@app.route('/api/download/<project_name>')
def download_project(project_name):
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    
    if not os.path.exists(project_path):
        return jsonify({'error': 'Project not found'}), 404
    
    # Create a temporary zip file
    import tempfile
    import io
    
    zip_buffer = io.BytesIO()
    
    try:
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Walk through the project directory and add all files
            for root, dirs, files in os.walk(project_path):
                # Skip hidden files and directories
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                files = [f for f in files if not f.startswith('.')]
                
                for file in files:
                    file_path = os.path.join(root, file)
                    # Get relative path from project directory
                    arcname = os.path.relpath(file_path, project_path)
                    zip_file.write(file_path, arcname)
        
        zip_buffer.seek(0)
        
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'{project_name}.zip'
        )
    except Exception as e:
        return jsonify({'error': f'Failed to create zip: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)
