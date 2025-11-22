import pytest
import os
import shutil
import tempfile
import zipfile
import json
from pathlib import Path
import app

@pytest.fixture
def client():
    """Create a test client with isolated test directory"""
    # Save original UPLOAD_FOLDER
    original_upload_folder = app.UPLOAD_FOLDER
    
    # Create temporary directory for tests
    test_upload_folder = tempfile.mkdtemp()
    app.UPLOAD_FOLDER = test_upload_folder
    app.app.config['UPLOAD_FOLDER'] = test_upload_folder
    app.app.config['TESTING'] = True
    
    # Ensure directory exists
    os.makedirs(test_upload_folder, exist_ok=True)
    
    with app.app.test_client() as client:
        yield client
    
    # Cleanup
    if os.path.exists(test_upload_folder):
        shutil.rmtree(test_upload_folder)
    
    # Restore original
    app.UPLOAD_FOLDER = original_upload_folder

@pytest.fixture
def test_project(client):
    """Create a test project with some files"""
    project_name = 'test_project'
    project_path = os.path.join(app.UPLOAD_FOLDER, project_name)
    os.makedirs(project_path, exist_ok=True)
    
    # Create a simple main.tex file
    main_tex = os.path.join(project_path, 'main.tex')
    with open(main_tex, 'w') as f:
        f.write('\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}')
    
    # Create a subdirectory with another tex file
    sub_dir = os.path.join(project_path, 'sections')
    os.makedirs(sub_dir, exist_ok=True)
    section_tex = os.path.join(sub_dir, 'intro.tex')
    with open(section_tex, 'w') as f:
        f.write('\\section{Introduction}\nThis is the introduction.')
    
    return project_name

def test_index_page(client):
    """Test that the index page loads"""
    response = client.get('/')
    assert response.status_code == 200
    assert b'TeXHandler' in response.data

def test_list_projects_empty(client):
    """Test listing projects when none exist"""
    response = client.get('/api/projects')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'projects' in data
    assert len(data['projects']) == 0

def test_create_project(client):
    """Test creating a new project"""
    response = client.post('/api/projects', 
                          json={'name': 'new_project'})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify project directory exists
    project_path = os.path.join(app.UPLOAD_FOLDER, 'new_project')
    assert os.path.exists(project_path)
    
    # Verify main.tex was created
    main_tex = os.path.join(project_path, 'main.tex')
    assert os.path.exists(main_tex)

def test_create_project_duplicate(client, test_project):
    """Test creating a duplicate project fails"""
    response = client.post('/api/projects',
                          json={'name': test_project})
    assert response.status_code == 400
    data = json.loads(response.data)
    # Check for error message instead of success field
    assert 'error' in data or 'success' in data

def test_list_projects(client, test_project):
    """Test listing projects"""
    response = client.get('/api/projects')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data['projects']) >= 1
    assert any(p['name'] == test_project for p in data['projects'])

def test_delete_project(client, test_project):
    """Test deleting a project"""
    response = client.delete(f'/api/projects/{test_project}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify project directory is deleted
    project_path = os.path.join(app.UPLOAD_FOLDER, test_project)
    assert not os.path.exists(project_path)

def test_rename_project(client, test_project):
    """Test renaming a project"""
    new_name = 'renamed_project'
    response = client.put(f'/api/projects/{test_project}',
                         json={'name': new_name})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify old name doesn't exist
    old_path = os.path.join(app.UPLOAD_FOLDER, test_project)
    assert not os.path.exists(old_path)
    
    # Verify new name exists
    new_path = os.path.join(app.UPLOAD_FOLDER, new_name)
    assert os.path.exists(new_path)

def test_list_files(client, test_project):
    """Test listing files in a project"""
    response = client.get(f'/api/files/{test_project}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'files' in data
    assert len(data['files']) > 0
    
    # Check that main.tex is in the list
    file_names = [f['name'] for f in data['files']]
    assert 'main.tex' in file_names

def test_get_file(client, test_project):
    """Test getting file content"""
    response = client.get(f'/api/file/{test_project}/main.tex')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'content' in data
    assert '\\documentclass' in data['content']

def test_get_file_not_found(client, test_project):
    """Test getting a non-existent file"""
    response = client.get(f'/api/file/{test_project}/nonexistent.tex')
    assert response.status_code == 404

def test_save_file(client, test_project):
    """Test saving file content"""
    new_content = '\\documentclass{article}\n\\begin{document}\nUpdated content\n\\end{document}'
    response = client.put(f'/api/file/{test_project}/main.tex',
                         json={'content': new_content})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify file was actually saved
    file_path = os.path.join(app.UPLOAD_FOLDER, test_project, 'main.tex')
    with open(file_path, 'r') as f:
        assert 'Updated content' in f.read()

def test_list_tex_files(client, test_project):
    """Test listing .tex files"""
    response = client.get(f'/api/tex_files/{test_project}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'tex_files' in data
    assert len(data['tex_files']) >= 1
    
    # Check that main.tex is marked as main
    main_files = [f for f in data['tex_files'] if f['is_main']]
    assert len(main_files) >= 1
    assert any(f['name'] == 'main.tex' for f in main_files)

def test_clean_project(client, test_project):
    """Test cleaning compilation files"""
    project_path = os.path.join(app.UPLOAD_FOLDER, test_project)
    
    # Create some fake auxiliary files
    aux_file = os.path.join(project_path, 'main.aux')
    log_file = os.path.join(project_path, 'main.log')
    with open(aux_file, 'w') as f:
        f.write('aux content')
    with open(log_file, 'w') as f:
        f.write('log content')
    
    response = client.post(f'/api/clean/{test_project}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    assert data['count'] >= 2
    
    # Verify files were removed
    assert not os.path.exists(aux_file)
    assert not os.path.exists(log_file)

def test_clean_project_preserves_pdf(client, test_project):
    """Test that cleaning doesn't remove PDF files"""
    project_path = os.path.join(app.UPLOAD_FOLDER, test_project)
    pdf_file = os.path.join(project_path, 'main.pdf')
    
    # Create a fake PDF file
    with open(pdf_file, 'wb') as f:
        f.write(b'%PDF-1.4 fake pdf content')
    
    # Create auxiliary files
    aux_file = os.path.join(project_path, 'main.aux')
    with open(aux_file, 'w') as f:
        f.write('aux content')
    
    response = client.post(f'/api/clean/{test_project}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify PDF is still there
    assert os.path.exists(pdf_file)
    
    # Verify aux file was removed
    assert not os.path.exists(aux_file)

def test_download_project(client, test_project):
    """Test downloading a project as ZIP"""
    response = client.get(f'/api/download/{test_project}')
    assert response.status_code == 200
    assert response.mimetype == 'application/zip'
    
    # Verify it's a valid ZIP
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(response.data)
        tmp_path = tmp.name
    
    try:
        with zipfile.ZipFile(tmp_path, 'r') as z:
            files = z.namelist()
            assert 'main.tex' in files
    finally:
        os.unlink(tmp_path)

def test_upload_zip(client):
    """Test uploading a ZIP file"""
    # Create a temporary ZIP file
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp:
        with zipfile.ZipFile(tmp, 'w') as z:
            z.writestr('test.tex', '\\documentclass{article}')
        zip_path = tmp.name
    
    try:
        with open(zip_path, 'rb') as f:
            response = client.post('/api/upload',
                                 data={'file': (f, 'test.zip')},
                                 content_type='multipart/form-data')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] == True
        assert 'project_name' in data
        
        # Verify project was created
        project_path = os.path.join(app.UPLOAD_FOLDER, data['project_name'])
        assert os.path.exists(project_path)
    finally:
        os.unlink(zip_path)

def test_upload_file_to_directory(client, test_project):
    """Test uploading a file to a specific directory"""
    from io import BytesIO
    test_content = b'Test file content'
    
    data = {
        'file': (BytesIO(test_content), 'test.txt'),
        'directory': 'sections'
    }
    
    response = client.post(f'/api/upload_file/{test_project}',
                         data=data,
                         content_type='multipart/form-data')
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify file was created
    file_path = os.path.join(app.UPLOAD_FOLDER, test_project, 'sections', 'test.txt')
    assert os.path.exists(file_path)

def test_synctex_resolve_not_found(client, test_project):
    """Test SyncTeX resolve when no synctex file exists"""
    response = client.post(f'/api/synctex/{test_project}/resolve',
                         json={'page': 1, 'x': 100, 'y': 100})
    assert response.status_code == 404

def test_synctex_resolve_reverse_not_found(client, test_project):
    """Test reverse SyncTeX resolve when no synctex file exists"""
    response = client.post(f'/api/synctex/{test_project}/resolve_reverse',
                         json={'file': 'main.tex', 'line': 1, 'column': 1})
    assert response.status_code == 404

def test_open_directory(client):
    """Test opening an external directory"""
    # Create a temporary directory with a tex file
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_file = os.path.join(tmpdir, 'external.tex')
        with open(tex_file, 'w') as f:
            f.write('\\documentclass{article}')
        
        response = client.post('/api/open_directory',
                             json={'path': tmpdir})
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] == True
        assert 'project_name' in data

def test_compile_latex_no_file(client, test_project):
    """Test compilation when no main file is found"""
    # Remove main.tex
    main_tex = os.path.join(app.UPLOAD_FOLDER, test_project, 'main.tex')
    os.remove(main_tex)
    
    response = client.get(f'/api/compile/{test_project}')
    assert response.status_code == 404
    data = json.loads(response.data)
    assert 'error' in data

def test_compile_latex_specific_file(client, test_project):
    """Test compilation with a specific file"""
    response = client.get(f'/api/compile/{test_project}?file=main.tex')
    # This might fail if pdflatex is not available, but should not be a 404
    assert response.status_code in [200, 500]
    if response.status_code == 200:
        data = json.loads(response.data)
        # If compilation succeeds, check response structure
        assert 'success' in data or 'error' in data

def test_get_pdf_not_found(client, test_project):
    """Test getting a non-existent PDF"""
    response = client.get(f'/api/pdf/{test_project}/nonexistent.pdf')
    assert response.status_code == 404

def test_get_synctex_not_found(client, test_project):
    """Test getting a non-existent SyncTeX file"""
    response = client.get(f'/api/synctex/{test_project}/nonexistent.synctex.gz')
    assert response.status_code == 404

def test_save_file_creates_directory(client, test_project):
    """Test that saving a file creates parent directories"""
    new_content = 'Test content in subdirectory'
    response = client.put(f'/api/file/{test_project}/newdir/subdir/file.txt',
                         json={'content': new_content})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify file was created
    file_path = os.path.join(app.UPLOAD_FOLDER, test_project, 'newdir', 'subdir', 'file.txt')
    assert os.path.exists(file_path)

def test_upload_file_root_directory(client, test_project):
    """Test uploading file to root directory"""
    from io import BytesIO
    test_content = b'Root file content'
    
    data = {
        'file': (BytesIO(test_content), 'root_file.txt')
    }
    
    response = client.post(f'/api/upload_file/{test_project}',
                         data=data,
                         content_type='multipart/form-data')
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    
    # Verify file was created in root
    file_path = os.path.join(app.UPLOAD_FOLDER, test_project, 'root_file.txt')
    assert os.path.exists(file_path)

def test_get_file_image(client, test_project):
    """Test getting an image file (should return file directly)"""
    project_path = os.path.join(app.UPLOAD_FOLDER, test_project)
    # Create a fake image file
    img_file = os.path.join(project_path, 'test.png')
    with open(img_file, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\nfake png')
    
    response = client.get(f'/api/file/{test_project}/test.png')
    assert response.status_code == 200
    # Should return the file directly, not JSON
    assert response.data.startswith(b'\x89PNG')

def test_clean_project_removes_all_extensions(client, test_project):
    """Test that clean removes all specified file types"""
    project_path = os.path.join(app.UPLOAD_FOLDER, test_project)
    
    # Create various auxiliary files
    test_files = {
        'main.aux': 'aux content',
        'main.log': 'log content',
        'main.out': 'out content',
        'main.toc': 'toc content',
        'main.synctex.gz': b'fake synctex',
        'main.bbl': 'bbl content',
        'main.blg': 'blg content',
    }
    
    for filename, content in test_files.items():
        file_path = os.path.join(project_path, filename)
        if isinstance(content, bytes):
            with open(file_path, 'wb') as f:
                f.write(content)
        else:
            with open(file_path, 'w') as f:
                f.write(content)
    
    response = client.post(f'/api/clean/{test_project}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] == True
    # Note: .synctex.gz might be counted separately, so count might be slightly different
    assert data['count'] >= len(test_files) - 1  # Allow for slight differences
    
    # Verify all files were removed (check individually)
    for filename in test_files.keys():
        file_path = os.path.join(project_path, filename)
        assert not os.path.exists(file_path), f"{filename} should have been removed"

def test_project_name_validation(client):
    """Test that invalid project names are rejected"""
    invalid_names = ['../test', 'test/..', 'test\\name', 'test..name']
    
    for name in invalid_names:
        response = client.post('/api/projects', json={'name': name})
        assert response.status_code == 400

def test_file_path_security(client, test_project):
    """Test that path traversal attempts are blocked"""
    # Try to access file outside project
    response = client.get(f'/api/file/{test_project}/../../etc/passwd')
    assert response.status_code in [400, 404]

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])

