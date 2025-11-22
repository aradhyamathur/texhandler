let currentProject = null;
let currentFilePath = null;
let editor = null;
let fileTreeData = null;
let currentDirectory = '';
let isImageFile = false;
let lastFocusedElement = null; // Track last focused element (editor or PDF)
let pdfSearchActive = false;
let editorSearchActive = false;
let editorSearchQuery = '';
let editorSearchResults = [];
let currentSearchIndex = -1;
let searchMarkers = [];
let editorSearchCaseSensitive = false;
let editorSearchRegexMode = false;
let autosaveEnabled = false;
let autosaveTimeout = null;

// LaTeX commands and environments for autocomplete
const latexCommands = [
    // Document structure
    '\\documentclass', '\\begin', '\\end', '\\document', '\\usepackage', '\\input', '\\include',
    // Sections
    '\\part', '\\chapter', '\\section', '\\subsection', '\\subsubsection', '\\paragraph', '\\subparagraph',
    // Text formatting
    '\\textbf', '\\textit', '\\emph', '\\underline', '\\texttt', '\\textsc', '\\textsf', '\\textrm',
    '\\textmd', '\\textup', '\\textsl', '\\textnormal',
    // Font sizes
    '\\tiny', '\\scriptsize', '\\footnotesize', '\\small', '\\normalsize', '\\large', '\\Large', '\\LARGE', '\\huge', '\\Huge',
    // Math
    '\\frac', '\\sqrt', '\\sum', '\\prod', '\\int', '\\oint', '\\lim', '\\infty', '\\partial',
    '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon', '\\zeta', '\\eta', '\\theta', '\\vartheta',
    '\\iota', '\\kappa', '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\varpi', '\\rho', '\\varrho',
    '\\sigma', '\\varsigma', '\\tau', '\\upsilon', '\\phi', '\\varphi', '\\chi', '\\psi', '\\omega',
    '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi', '\\Sigma', '\\Upsilon', '\\Phi', '\\Psi', '\\Omega',
    '\\cdot', '\\times', '\\div', '\\pm', '\\mp', '\\leq', '\\geq', '\\neq', '\\approx', '\\equiv',
    '\\in', '\\notin', '\\subset', '\\supset', '\\subseteq', '\\supseteq', '\\cup', '\\cap', '\\emptyset',
    '\\leftarrow', '\\rightarrow', '\\Leftarrow', '\\Rightarrow', '\\leftrightarrow', '\\Leftrightarrow',
    '\\forall', '\\exists', '\\nexists', '\\nabla', '\\partial', '\\prime',
    // Environments
    '\\begin{equation}', '\\begin{align}', '\\begin{alignat}', '\\begin{flalign}', '\\begin{multline}',
    '\\begin{gather}', '\\begin{eqnarray}', '\\begin{array}', '\\begin{matrix}', '\\begin{pmatrix}',
    '\\begin{bmatrix}', '\\begin{vmatrix}', '\\begin{Vmatrix}', '\\begin{cases}',
    '\\begin{enumerate}', '\\begin{itemize}', '\\begin{description}', '\\begin{verbatim}',
    '\\begin{quote}', '\\begin{quotation}', '\\begin{verse}', '\\begin{center}', '\\begin{flushleft}',
    '\\begin{flushright}', '\\begin{abstract}', '\\begin{theorem}', '\\begin{lemma}', '\\begin{proof}',
    '\\begin{definition}', '\\begin{proposition}', '\\begin{corollary}', '\\begin{example}',
    '\\begin{figure}', '\\begin{table}', '\\begin{minipage}', '\\begin{multicols}',
    // Lists
    '\\item', '\\itemize', '\\enumerate', '\\description',
    // References
    '\\label', '\\ref', '\\pageref', '\\eqref', '\\autoref', '\\nameref', '\\cite', '\\citep', '\\citet',
    // Figures and tables
    '\\includegraphics', '\\caption', '\\centering', '\\subcaption', '\\subfigure',
    '\\tabular', '\\hline', '\\cline', '\\multicolumn', '\\multirow',
    // Spacing
    '\\quad', '\\qquad', '\\,', '\\:', '\\;', '\\!', '\\hspace', '\\vspace', '\\hfill', '\\vfill',
    '\\newline', '\\linebreak', '\\pagebreak', '\\newpage', '\\clearpage',
    // Colors
    '\\textcolor', '\\color', '\\colorbox', '\\fcolorbox', '\\definecolor',
    // Boxes and frames
    '\\fbox', '\\framebox', '\\parbox', '\\makebox', '\\mbox', '\\sbox',
    // Footnotes
    '\\footnote', '\\footnotemark', '\\footnotetext',
    // URLs and links
    '\\url', '\\href', '\\hyperref',
    // Special characters
    '\\&', '\\%', '\\$', '\\#', '\\{', '\\}', '\\_', '\\^', '\\~', '\\textbackslash',
    // Commands
    '\\newcommand', '\\renewcommand', '\\newenvironment', '\\renewenvironment',
    '\\def', '\\let', '\\providecommand',
    // Counters
    '\\newcounter', '\\setcounter', '\\addtocounter', '\\stepcounter', '\\value',
    // Lengths
    '\\newlength', '\\setlength', '\\addtolength', '\\settowidth', '\\settoheight', '\\settodepth',
    // Boxes
    '\\raisebox', '\\rule', '\\strut',
    // Misc
    '\\today', '\\maketitle', '\\tableofcontents', '\\listoffigures', '\\listoftables',
    '\\bibliography', '\\bibliographystyle', '\\index', '\\printindex',
    '\\appendix', '\\frontmatter', '\\mainmatter', '\\backmatter',
    '\\verb', '\\verbatim', '\\lstinline', '\\lstinputlisting',
    '\\marginpar', '\\footnote', '\\sidenote',
    // TikZ/PGF (common)
    '\\tikz', '\\draw', '\\fill', '\\node', '\\path', '\\coordinate',
    // Beamer (common)
    '\\frame', '\\frametitle', '\\framesubtitle', '\\pause', '\\only', '\\uncover',
    // Algorithmic
    '\\algorithm', '\\algorithmic', '\\State', '\\If', '\\Else', '\\ElsIf', '\\For', '\\ForAll', '\\While', '\\Repeat', '\\Until',
    // SI units
    '\\si', '\\SI', '\\num', '\\ang',
    // Custom
    '\\todo', '\\note', '\\fixme'
];

// LaTeX autocomplete hint function
function latexHint(editor, options) {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const token = editor.getTokenAt(cursor);
    const start = token.start;
    const end = cursor.ch;
    const word = line.slice(start, end);
    
    // Check if we're after a backslash or in a command
    let searchStart = start;
    if (word.startsWith('\\')) {
        // We're typing a command
        const matches = latexCommands.filter(cmd => cmd.toLowerCase().startsWith(word.toLowerCase()));
        if (matches.length > 0) {
            return {
                list: matches.map(cmd => ({
                    text: cmd,
                    displayText: cmd,
                    className: 'latex-command'
                })),
                from: CodeMirror.Pos(cursor.line, start),
                to: CodeMirror.Pos(cursor.line, end)
            };
        }
    } else if (line[cursor.ch - 1] === '\\') {
        // Just typed a backslash, show all commands
        return {
            list: latexCommands.map(cmd => ({
                text: cmd,
                displayText: cmd,
                className: 'latex-command'
            })),
            from: CodeMirror.Pos(cursor.line, cursor.ch - 1),
            to: CodeMirror.Pos(cursor.line, cursor.ch)
        };
    }
    
    // Also check for environment names after \begin{ or \end{
    const beginMatch = line.slice(0, cursor.ch).match(/\\begin\{([^}]*)$/);
    const endMatch = line.slice(0, cursor.ch).match(/\\end\{([^}]*)$/);
    
    if (beginMatch || endMatch) {
        const envName = (beginMatch || endMatch)[1];
        const envCommands = latexCommands.filter(cmd => 
            cmd.startsWith('\\begin{') && cmd.toLowerCase().includes(envName.toLowerCase())
        );
        
        if (envCommands.length > 0) {
            const envNames = envCommands.map(cmd => {
                const match = cmd.match(/\\begin\{([^}]+)\}/);
                return match ? match[1] : null;
            }).filter(Boolean);
            
            const uniqueEnvs = [...new Set(envNames)];
            const matches = uniqueEnvs.filter(env => 
                env.toLowerCase().startsWith(envName.toLowerCase())
            );
            
            if (matches.length > 0) {
                const matchStart = (beginMatch || endMatch).index + (beginMatch ? 7 : 5);
                return {
                    list: matches.map(env => ({
                        text: env,
                        displayText: env,
                        className: 'latex-environment'
                    })),
                    from: CodeMirror.Pos(cursor.line, matchStart),
                    to: CodeMirror.Pos(cursor.line, cursor.ch)
                };
            }
        }
    }
    
    return null;
}

// Initialize CodeMirror editor
function initEditor() {
    const editorElement = document.getElementById('editor');
    editor = CodeMirror(editorElement, {
        value: '',
        mode: 'stex',
        theme: 'monokai',
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 4,
        autofocus: true,
        extraKeys: {
            'Ctrl-Space': 'autocomplete',
            'Ctrl-F': function(cm, event) {
                // Prevent default browser find dialog
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                // Toggle search dialog
                console.log('CodeMirror Ctrl-F handler called');
                toggleEditorSearch(cm);
                lastFocusedElement = 'editor';
                return false; // Return false to stop propagation
            },
            'Tab': function(cm) {
                // Try LaTeX autocomplete first, fall back to default
                const hint = latexHint(cm);
                if (hint) {
                    CodeMirror.showHint(cm, latexHint, {completeSingle: false});
                } else {
                    cm.execCommand('indentMore');
                }
            }
        },
        hintOptions: {
            hint: latexHint,
            completeSingle: false,
            alignWithWord: true
        }
    });
    
    // Override CodeMirror's default find command to use our custom search
    if (CodeMirror.commands && CodeMirror.commands.find) {
        // Override it to use our custom search
        CodeMirror.commands.find = function(cm) {
            console.log('CodeMirror find command called, using custom search');
            toggleEditorSearch(cm);
            return false; // Prevent default behavior
        };
    }
    
    // Initialize search state - ensure search container is hidden on editor init
    const searchContainer = document.getElementById('editorSearchContainer');
    if (searchContainer) {
        searchContainer.style.display = 'none';
        editorSearchActive = false;
    }
    
    // Enable autocomplete on backslash
    editor.on('inputRead', function(cm, change) {
        if (change.text && change.text.length > 0) {
            const text = change.text[0];
            if (text === '\\' || text.endsWith('\\')) {
                setTimeout(() => {
                    CodeMirror.showHint(cm, latexHint, {completeSingle: false});
                }, 50);
            }
        }
    });
    
    // Also trigger on typing in commands after backslash
    let autocompleteTimeout;
    editor.on('change', function(cm, change) {
        if (change.text && change.text.length > 0) {
            const cursor = cm.getCursor();
            const line = cm.getLine(cursor.line);
            const ch = cursor.ch;
            
            // Check if we're typing after a backslash
            if (ch > 0) {
                const char = line[ch - 1];
                const beforeBackslash = line.lastIndexOf('\\', ch - 1);
                
                if (char === '\\' || (beforeBackslash >= 0 && ch - beforeBackslash <= 20 && /[a-zA-Z]/.test(char))) {
                    clearTimeout(autocompleteTimeout);
                    autocompleteTimeout = setTimeout(() => {
                        const hint = latexHint(cm);
                        if (hint && hint.list && hint.list.length > 0) {
                            CodeMirror.showHint(cm, latexHint, {completeSingle: false});
                        }
                    }, 300);
                }
            }
        }
        
        // Autosave functionality
        if (autosaveEnabled && currentProject && currentFilePath && !isImageFile) {
            // Clear existing timeout
            if (autosaveTimeout) {
                clearTimeout(autosaveTimeout);
            }
            
            // Debounce autosave - save after 1 second of no changes
            autosaveTimeout = setTimeout(() => {
                saveFile(true); // Pass true to indicate autosave (suppress success message)
            }, 1000);
        }
    });
    
    // Ensure editor fills the container
    const resizeEditor = () => {
        if (editor) {
            editor.setSize('100%', '100%');
            editor.refresh();
        }
    };
    
    setTimeout(resizeEditor, 100);
    setTimeout(resizeEditor, 500);
    
    // Refresh on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeEditor, 100);
    });
    
    // Also refresh when editor panel becomes visible
    const observer = new MutationObserver(() => {
        if (document.getElementById('editorPanel').style.display !== 'none') {
            setTimeout(resizeEditor, 100);
        }
    });
    
    observer.observe(document.getElementById('editorPanel'), {
        attributes: true,
        attributeFilter: ['style']
    });
    
    // Track focus on editor
    editor.getWrapperElement().addEventListener('mousedown', function(event) {
        lastFocusedElement = 'editor';
    });
    
    // Add triple-click detection for PDF highlighting
    let clickCount = 0;
    let clickTimer = null;
    let lastClickTime = 0;
    
    editor.getWrapperElement().addEventListener('mousedown', function(event) {
        const now = Date.now();
        if (now - lastClickTime < 400) {
            clickCount++;
        } else {
            clickCount = 1;
        }
        lastClickTime = now;
        
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            if (clickCount === 3) {
                // Triple click detected
                handleEditorTripleClick();
            }
            clickCount = 0;
        }, 400);
    });
}

// Toggle editor search dialog
function toggleEditorSearch(cm) {
    const searchContainer = document.getElementById('editorSearchContainer');
    const searchInput = document.getElementById('editorSearchInput');
    
    if (!searchContainer || !searchInput) {
        console.error('Search container or input not found');
        return;
    }
    
    // Check if search is currently visible - check computed style as source of truth
    const inlineDisplay = searchContainer.style.display || '';
    const computedStyle = window.getComputedStyle(searchContainer);
    const computedDisplay = computedStyle.display;
    const computedVisibility = computedStyle.visibility;
    const computedOpacity = computedStyle.opacity;
    const rect = searchContainer.getBoundingClientRect();
    
    // Element is actually visible only if:
    // 1. Computed display is not 'none'
    // 2. Visibility is not 'hidden'
    // 3. Opacity is not 0
    // 4. Has a visible bounding box (width/height > 0)
    const isActuallyVisible = computedDisplay !== 'none' && 
                               computedVisibility !== 'hidden' && 
                               parseFloat(computedOpacity) > 0 &&
                               rect.width > 0 && 
                               rect.height > 0;
    
    console.log('toggleEditorSearch called, inlineDisplay:', inlineDisplay, 'computedDisplay:', computedDisplay, 'computedVisibility:', computedVisibility, 'computedOpacity:', computedOpacity, 'rect:', rect, 'isActuallyVisible:', isActuallyVisible);
    
    // Check if editor panel is visible
    const editorPanel = document.getElementById('editorPanel');
    const editorPanelVisible = editorPanel && window.getComputedStyle(editorPanel).display !== 'none';
    console.log('Editor panel visible:', editorPanelVisible);
    
    // Use actual visibility check instead of inline style
    if (isActuallyVisible && editorPanelVisible) {
        // Close search - it's currently visible
        console.log('Closing search');
        closeEditorSearch();
    } else {
        // Open search - it's currently hidden
        console.log('Opening search');
        // Ensure editor panel is visible first
        if (!editorPanelVisible) {
            console.warn('Editor panel is not visible, search may not show');
        }
        
        // Force the display property
        searchContainer.style.display = 'flex';
        searchContainer.style.visibility = 'visible';
        searchContainer.style.opacity = '1';
        searchInput.value = editorSearchQuery || '';
        editorSearchActive = true;
        
        // Update toggle button states
        const caseBtn = document.getElementById('editorSearchCaseBtn');
        const regexBtn = document.getElementById('editorSearchRegexBtn');
        if (caseBtn) {
            caseBtn.classList.toggle('active', editorSearchCaseSensitive);
        }
        if (regexBtn) {
            regexBtn.classList.toggle('active', editorSearchRegexMode);
        }
        
        // Verify it's actually visible after setting
        setTimeout(() => {
            const finalComputed = window.getComputedStyle(searchContainer);
            const finalRect = searchContainer.getBoundingClientRect();
            const parentComputed = window.getComputedStyle(searchContainer.parentElement);
            const editorPanelComputed = editorPanel ? window.getComputedStyle(editorPanel) : null;
            
            console.log('After opening - computed display:', finalComputed.display, 'visibility:', finalComputed.visibility, 'opacity:', finalComputed.opacity);
            console.log('After opening - bounding rect:', finalRect);
            console.log('After opening - parent (editor-actions) display:', parentComputed.display);
            console.log('After opening - editor panel display:', editorPanelComputed ? editorPanelComputed.display : 'N/A');
            
            // Check if it's actually visible
            const isNowVisible = finalComputed.display !== 'none' && 
                                finalComputed.visibility !== 'hidden' && 
                                parseFloat(finalComputed.opacity) > 0 &&
                                finalRect.width > 0 && 
                                finalRect.height > 0;
            
            if (isNowVisible) {
                searchInput.focus();
                searchInput.select();
                console.log('Search container is now visible, input focused');
            } else {
                console.error('Search container is not visible after setting display:flex. Parent might be hidden.');
                // Try to ensure parent containers are visible
                if (editorPanel && editorPanelComputed && editorPanelComputed.display === 'none') {
                    console.warn('Editor panel is hidden, making it visible');
                    editorPanel.style.display = 'flex';
                }
                // Retry after a short delay
                setTimeout(() => {
                    searchContainer.style.display = 'flex';
                    searchInput.focus();
                    searchInput.select();
                }, 100);
            }
        }, 50);
        
        // If there's existing query, search immediately
        if (editorSearchQuery) {
            performEditorSearch(editorSearchQuery);
        }
    }
}

// Close editor search and clear highlights
function closeEditorSearch() {
    const searchContainer = document.getElementById('editorSearchContainer');
    const searchInput = document.getElementById('editorSearchInput');
    
    if (searchContainer) {
        searchContainer.style.display = 'none';
    }
    
    editorSearchActive = false;
    // Keep the query for next time user opens search
    // editorSearchQuery = '';
    editorSearchResults = [];
    currentSearchIndex = -1;
    
    // Clear all search highlights
    clearEditorSearchHighlights();
    
    // Update results display
    updateEditorSearchResults();
    
    // Focus back to editor after a short delay to ensure DOM updates complete
    setTimeout(() => {
        if (editor) {
            editor.focus();
            lastFocusedElement = 'editor';
        }
    }, 10);
}

// Clear search highlights
function clearEditorSearchHighlights() {
    if (!editor) return;
    
    // Clear current search marker
    if (window.currentSearchMarker) {
        try {
            window.currentSearchMarker.clear();
        } catch (e) {
            // Marker might already be cleared
        }
        window.currentSearchMarker = null;
    }
    
    // Clear all search markers
    searchMarkers.forEach(marker => {
        try {
            marker.clear();
        } catch (e) {
            // Marker might already be cleared
        }
    });
    searchMarkers = [];
}

// Perform search in editor
function performEditorSearch(query) {
    if (!editor || !query || !query.trim()) {
        clearEditorSearchHighlights();
        editorSearchResults = [];
        currentSearchIndex = -1;
        updateEditorSearchResults();
        return;
    }
    
    editorSearchQuery = query;
    editorSearchResults = [];
    currentSearchIndex = -1;
    
    // Clear previous highlights
    clearEditorSearchHighlights();
    
    const searchText = query.trim();
    const content = editor.getValue();
    const lines = content.split('\n');
    
    // Find all occurrences
    let regex;
    try {
        if (editorSearchRegexMode) {
            // Use as regex pattern
            const flags = editorSearchCaseSensitive ? 'g' : 'gi';
            regex = new RegExp(searchText, flags);
        } else {
            // Escape regex special characters for plain text search
            const escapedText = escapeRegex(searchText);
            const flags = editorSearchCaseSensitive ? 'g' : 'gi';
            regex = new RegExp(escapedText, flags);
        }
    } catch (e) {
        // Invalid regex, fall back to plain text search
        console.warn('Invalid regex pattern:', e.message);
        const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = editorSearchCaseSensitive ? 'g' : 'gi';
        regex = new RegExp(escapedText, flags);
    }
    
    lines.forEach((line, lineNum) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
            editorSearchResults.push({
                line: lineNum,
                ch: match.index,
                length: match[0].length
            });
        }
    });
    
    // Highlight all matches
    editorSearchResults.forEach((result, index) => {
        try {
            const marker = editor.markText(
                CodeMirror.Pos(result.line, result.ch),
                CodeMirror.Pos(result.line, result.ch + result.length),
                {
                    className: 'search-highlight',
                    css: 'background-color: rgba(255, 255, 0, 0.3); border: 1px solid rgba(255, 255, 0, 0.5);'
                }
            );
            searchMarkers.push(marker);
        } catch (e) {
            console.error('Error marking search result:', e);
        }
    });
    
    // Don't automatically navigate to first result when typing - only when user clicks next/prev
    // This prevents focus from being stolen from search input
    if (editorSearchResults.length > 0) {
        currentSearchIndex = 0;
        // Just highlight the first result without focusing editor
        const firstResult = editorSearchResults[0];
        if (firstResult && editor) {
            editor.setCursor(firstResult.line, firstResult.ch);
            editor.scrollIntoView({ line: firstResult.line, ch: firstResult.ch }, 100);
            // Don't call editor.focus() here - keep focus on search input
        }
    }
    
    updateEditorSearchResults();
}

// Navigate to next/previous search result
function navigateEditorSearch(direction) {
    if (editorSearchResults.length === 0) return;
    
    if (direction > 0) {
        // Next
        currentSearchIndex = (currentSearchIndex + 1) % editorSearchResults.length;
    } else {
        // Previous
        currentSearchIndex = currentSearchIndex - 1;
        if (currentSearchIndex < 0) {
            currentSearchIndex = editorSearchResults.length - 1;
        }
    }
    
    const result = editorSearchResults[currentSearchIndex];
    if (result) {
        // Clear previous current marker
        if (window.currentSearchMarker) {
            try {
                window.currentSearchMarker.clear();
            } catch (e) {
                // Marker might already be cleared
            }
            window.currentSearchMarker = null;
        }
        
        // Move cursor to the match
        editor.setCursor(result.line, result.ch);
        editor.scrollIntoView({ line: result.line, ch: result.ch }, 100);
        
        // Highlight the current match more prominently
        try {
            const currentMarker = editor.markText(
                CodeMirror.Pos(result.line, result.ch),
                CodeMirror.Pos(result.line, result.ch + result.length),
                {
                    className: 'search-highlight-current',
                    css: 'background-color: rgba(255, 255, 0, 0.6); border: 2px solid rgba(255, 255, 0, 0.8);'
                }
            );
            window.currentSearchMarker = currentMarker;
        } catch (e) {
            console.error('Error highlighting current result:', e);
        }
        
        // Don't focus editor when navigating - keep focus on search input
        // editor.focus(); // Removed to prevent stealing focus from search input
        updateEditorSearchResults();
    }
}

// Update search results display
function updateEditorSearchResults() {
    const resultsElement = document.getElementById('editorSearchResults');
    if (!resultsElement) return;
    
    if (editorSearchResults.length === 0) {
        if (editorSearchQuery) {
            resultsElement.textContent = 'No results';
        } else {
            resultsElement.textContent = '';
        }
    } else {
        resultsElement.textContent = `${currentSearchIndex + 1} of ${editorSearchResults.length}`;
    }
}

// Escape regex special characters
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Format date
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Load projects list
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        const select = document.getElementById('projectSelect');
        const currentValue = select.value; // Preserve current selection
        select.innerHTML = '<option value="">Select Project</option>';
        
        // Update dropdown
        data.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.name;
            option.textContent = project.name;
            select.appendChild(option);
        });
        
        // Restore selection if it still exists
        if (currentValue && data.projects.some(p => p.name === currentValue)) {
            select.value = currentValue;
        } else if (currentValue) {
            // Project was deleted/renamed, clear selection
            select.value = '';
        }
        
        // Update projects home view (always update, even if not visible)
        renderProjectsList(data.projects);
    } catch (error) {
        showStatus('Error loading projects: ' + error.message);
    }
}

// Render projects list
function renderProjectsList(projects) {
    const projectsList = document.getElementById('projectsList');
    projectsList.innerHTML = '';
    
    if (!projects || projects.length === 0) {
        projectsList.innerHTML = '<p class="empty-message">No projects yet. Create a new project, upload a ZIP file, or open a directory to get started!</p>';
        return;
    }
    
    projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        
        card.innerHTML = `
            <div class="project-card-header">
                <h3 class="project-name">${project.name}</h3>
            </div>
            <div class="project-info">
                <div>Size: ${formatFileSize(project.size)}</div>
                <div>Modified: ${formatDate(project.modified)}</div>
            </div>
            <div class="project-actions">
                <button class="btn btn-primary project-open-btn" data-project="${project.name}">Open</button>
                <button class="btn btn-secondary project-download-btn" data-project="${project.name}">Download</button>
                <button class="btn btn-secondary project-rename-btn" data-project="${project.name}">Rename</button>
                <button class="btn btn-danger project-delete-btn" data-project="${project.name}">Delete</button>
            </div>
        `;
        
        // Add event listeners
        card.querySelector('.project-open-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            // Navigate to project URL
            window.location.href = `/project/${encodeURIComponent(project.name)}`;
        });
        
        card.querySelector('.project-download-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `/api/download/${project.name}`;
        });
        
        card.querySelector('.project-rename-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            renameProject(project.name);
        });
        
        card.querySelector('.project-delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
                await deleteProject(project.name);
            }
        });
        
        projectsList.appendChild(card);
    });
}

// Create new project
async function createProject(projectName) {
    if (!projectName || !projectName.trim()) {
        showStatus('Project name cannot be empty');
        return;
    }
    
    showStatus('Creating project...');
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: projectName.trim() })
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Project created successfully');
            await loadProjects();
            // Navigate to project URL
            window.location.href = `/project/${encodeURIComponent(data.project_name)}`;
        } else {
            showStatus('Error creating project: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error creating project: ' + error.message);
    }
}

// Load LaTeX files for compilation
async function loadTexFiles(projectName) {
    try {
        const response = await fetch(`/api/tex_files/${projectName}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const select = document.getElementById('compileFileSelect');
        select.innerHTML = '<option value="">Auto-detect</option>';
        
        if (data.tex_files && data.tex_files.length > 0) {
            data.tex_files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.path;
                option.textContent = file.name + (file.is_main ? ' (main)' : '');
                if (file.is_main && !select.value) {
                    option.selected = true; // Auto-select main file
                }
                select.appendChild(option);
            });
            
            select.style.display = 'inline-block';
        } else {
            select.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading LaTeX files:', error);
        document.getElementById('compileFileSelect').style.display = 'none';
    }
}

// Open project
function openProject(projectName, skipHistory = false) {
    currentProject = projectName;
    document.getElementById('projectSelect').value = projectName;
    showEditorView();
    loadFileTree(projectName);
    loadTexFiles(projectName);
    updateUploadButton();
    updateDownloadButton();
    
    // Update URL without reloading page
    if (!skipHistory) {
        const newUrl = `/project/${encodeURIComponent(projectName)}`;
        window.history.pushState({ project: projectName }, '', newUrl);
        document.title = `${projectName} - TeXHandler`;
    }
}

// Show editor view
function showEditorView() {
    document.getElementById('projectsHome').style.display = 'none';
    document.getElementById('sidePanel').style.display = 'flex';
    document.getElementById('editorPanel').style.display = 'flex';
    document.getElementById('pdfPanel').style.display = 'flex';
    document.getElementById('logPanel').style.display = 'flex';
    document.getElementById('homeBtn').style.display = 'inline';
    
    // Load saved panel width
    loadSidePanelWidth();
}

// Side panel resizing functionality
let sidePanelResizing = false;
let sidePanelStartX = 0;
let sidePanelStartWidth = 0;

function initSidePanelResizer() {
    const sidePanel = document.getElementById('sidePanel');
    const resizer = document.getElementById('sidePanelResizer');
    
    if (!resizer || !sidePanel) return;
    
    resizer.addEventListener('mousedown', (e) => {
        sidePanelResizing = true;
        sidePanelStartX = e.clientX;
        sidePanelStartWidth = sidePanel.offsetWidth;
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        resizer.classList.add('resizing');
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!sidePanelResizing) return;
        
        const deltaX = e.clientX - sidePanelStartX;
        const newWidth = sidePanelStartWidth + deltaX;
        const minWidth = 150;
        const maxWidth = 600;
        
        // Clamp width between min and max
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        sidePanel.style.width = clampedWidth + 'px';
        
        // Save to localStorage
        localStorage.setItem('sidePanelWidth', clampedWidth.toString());
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('mouseup', () => {
        if (sidePanelResizing) {
            sidePanelResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizer.classList.remove('resizing');
        }
    });
}

// Load saved side panel width from localStorage
function loadSidePanelWidth() {
    const sidePanel = document.getElementById('sidePanel');
    if (!sidePanel) return;
    
    const savedWidth = localStorage.getItem('sidePanelWidth');
    if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        if (width >= 150 && width <= 600) {
            sidePanel.style.width = width + 'px';
        }
    }
}

// Show home view
function showHomeView(skipHistory = false) {
    document.getElementById('projectsHome').style.display = 'block';
    document.getElementById('sidePanel').style.display = 'none';
    document.getElementById('editorPanel').style.display = 'none';
    document.getElementById('pdfPanel').style.display = 'none';
    document.getElementById('logPanel').style.display = 'none';
    document.getElementById('homeBtn').style.display = 'none';
    
    // Update URL without reloading page
    if (!skipHistory) {
        window.history.pushState({ project: null }, '', '/');
        document.title = 'TeXHandler - LaTeX Editor';
    }
}

// Rename project
function renameProject(projectName) {
    const newName = prompt(`Enter new name for "${projectName}":`, projectName);
    if (newName && newName.trim() && newName.trim() !== projectName) {
        performRename(projectName, newName.trim());
    }
}

// Perform project rename
async function performRename(oldName, newName) {
    showStatus('Renaming project...');
    
    try {
        const response = await fetch(`/api/projects/${oldName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Project renamed successfully');
            // Update current project if it was the one being renamed
            const wasCurrentProject = currentProject === oldName;
            const isHomeViewVisible = document.getElementById('projectsHome').style.display !== 'none';
            
            if (wasCurrentProject) {
                currentProject = newName;
                document.getElementById('projectSelect').value = newName;
            }
            
            // Reload projects list to reflect changes
            await loadProjects();
            
            // If we're on home view, ensure it stays visible to show updated list
            if (isHomeViewVisible) {
                showHomeView();
            }
            // If we were editing the renamed project, reload the file tree with new name
            else if (wasCurrentProject) {
                await loadFileTree(newName);
            }
        } else {
            showStatus('Error renaming project: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error renaming project: ' + error.message);
    }
}

// Delete project
async function deleteProject(projectName) {
    try {
        const response = await fetch(`/api/projects/${projectName}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Project deleted successfully');
            const wasCurrentProject = currentProject === projectName;
            if (wasCurrentProject) {
                currentProject = null;
                document.getElementById('projectSelect').value = '';
            }
            // Reload projects list to reflect changes
            await loadProjects();
            // Always show home view after deletion to see updated list
            showHomeView();
        } else {
            showStatus('Error deleting project: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error deleting project: ' + error.message);
    }
}

// Load file tree
async function loadFileTree(projectName) {
    try {
        const response = await fetch(`/api/files/${projectName}`);
        const data = await response.json();
        fileTreeData = data.files;
        renderFileTree(data.files);
        // Reset to root when loading new project
        setUploadTarget('');
    } catch (error) {
        showStatus('Error loading files: ' + error.message);
    }
}

// Render file tree
function renderFileTree(files, container = null, parentPath = '') {
    const treeContainer = container || document.getElementById('fileTree');
    if (!container) {
        treeContainer.innerHTML = '';
    }
    
    if (!files || files.length === 0) {
        if (!container) {
            treeContainer.innerHTML = '<p class="empty-message">No files</p>';
        }
        return;
    }
    
    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.path = file.path;
        item.dataset.type = file.type;
        item.dataset.dir = file.type === 'directory' ? file.path : parentPath;
        
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = file.type === 'directory' ? '📁' : getFileIcon(file.name);
        
        const name = document.createElement('span');
        name.textContent = file.name;
        
        item.appendChild(icon);
        item.appendChild(name);
        
        if (file.type === 'directory') {
            item.classList.add('directory');
            // Left click - expand/collapse and set as upload target
            item.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmd + Click: Select as upload target without expanding
                    e.stopPropagation();
                    e.preventDefault();
                    // Remove highlight from all other folders
                    document.querySelectorAll('.file-item.directory').forEach(i => i.classList.remove('selected'));
                    // Add highlight to this folder
                    item.classList.add('selected');
                    setUploadTarget(file.path, item);
                } else {
                    // Normal click: Expand/collapse and set as upload target
                    e.stopPropagation();
                    item.classList.toggle('expanded');
                    // Remove highlight from all other folders
                    document.querySelectorAll('.file-item.directory').forEach(i => i.classList.remove('selected'));
                    // Add highlight to this folder
                    item.classList.add('selected');
                    setUploadTarget(file.path, item);
                }
            });
            
            // Right-click: Set as upload target
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // Remove highlight from all other folders
                document.querySelectorAll('.file-item.directory').forEach(i => i.classList.remove('selected'));
                // Add highlight to this folder
                item.classList.add('selected');
                setUploadTarget(file.path, item);
            });
            
            if (file.children && file.children.length > 0) {
                const children = document.createElement('div');
                children.className = 'file-children';
                renderFileTree(file.children, children, file.path);
                item.appendChild(children);
            }
        } else {
            // Left click - open file
            item.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmd + Click: Set parent directory as upload target without opening file
                    e.stopPropagation();
                    e.preventDefault();
                    setUploadTarget(parentPath, item);
                } else {
                    // Normal click: Open file and set parent directory as upload target
                    loadFile(currentProject, file.path);
                    document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    // Set current directory to file's parent (so uploads go to same directory)
                    // Also highlight the parent folder if it exists
                    if (parentPath) {
                        const parentFolder = document.querySelector(`[data-path="${parentPath}"][data-type="directory"]`);
                        if (parentFolder) {
                            // Remove highlight from all other folders
                            document.querySelectorAll('.file-item.directory').forEach(i => i.classList.remove('selected'));
                            // Add highlight to parent folder
                            parentFolder.classList.add('selected');
                        }
                    }
                    setUploadTarget(parentPath);
                }
            });
            
            // Right-click: Set parent directory as upload target
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                setUploadTarget(parentPath, item);
            });
        }
        
        treeContainer.appendChild(item);
    });
}

// Set upload target directory and update UI
function setUploadTarget(directory, item = null) {
    // Remove previous upload-target selection (but keep selected class for folders)
    document.querySelectorAll('.file-item').forEach(i => i.classList.remove('upload-target'));
    
    // Set new directory
    currentDirectory = directory || '';
    
    // Highlight the selected item if provided
    if (item) {
        item.classList.add('upload-target');
    } else if (currentDirectory) {
        // Find and highlight the directory item
        const targetItem = document.querySelector(`[data-path="${currentDirectory}"][data-type="directory"]`);
        if (targetItem) {
            targetItem.classList.add('upload-target');
        }
    }
    
    updateUploadButton();
    showStatus(currentDirectory ? `Upload target: ${currentDirectory}` : 'Upload target: root directory');
}

// Update upload button visibility
function updateUploadButton() {
    const uploadBtn = document.getElementById('uploadFileBtn');
    const newFileBtn = document.getElementById('newFileBtn');
    const newFolderBtn = document.getElementById('newFolderBtn');
    if (currentProject) {
        uploadBtn.style.display = 'block';
        newFileBtn.style.display = 'block';
        newFolderBtn.style.display = 'block';
    } else {
        uploadBtn.style.display = 'none';
        newFileBtn.style.display = 'none';
        newFolderBtn.style.display = 'none';
    }
    
    // Update tooltip to show current target directory
    if (currentDirectory) {
        uploadBtn.title = `Upload file to: ${currentDirectory}`;
        newFileBtn.title = `Create new file in: ${currentDirectory}`;
        newFolderBtn.title = `Create new folder in: ${currentDirectory}`;
    } else {
        uploadBtn.title = 'Upload file to project root';
        newFileBtn.title = 'Create new file in project root';
        newFolderBtn.title = 'Create new folder in project root';
    }
}

// Update download button visibility
function updateDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    const compileCleanBtn = document.getElementById('compileCleanBtn');
    if (currentProject) {
        downloadBtn.style.display = 'inline-block';
        compileCleanBtn.style.display = 'inline-block';
    } else {
        downloadBtn.style.display = 'none';
        compileCleanBtn.style.display = 'none';
    }
}

// Get file icon based on extension
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'tex': '📄',
        'pdf': '📕',
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'txt': '📝',
        'md': '📝',
        'json': '📋',
        'xml': '📋',
        'css': '🎨',
        'js': '⚙️'
    };
    return icons[ext] || '📄';
}

// Check if file is an image
function isImage(filename) {
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return imageExts.includes(ext);
}

// Load file content
async function loadFile(projectName, filePath) {
    try {
        const ext = filePath.split('.').pop().toLowerCase();
        isImageFile = isImage(filePath);
        
        currentFilePath = filePath;
        document.getElementById('currentFile').textContent = filePath;
        
        if (isImageFile) {
            // Show image
            const imageViewer = document.getElementById('imageViewer');
            const imageDisplay = document.getElementById('imageDisplay');
            const editorContainer = document.getElementById('editor');
            
            editorContainer.style.display = 'none';
            imageViewer.style.display = 'flex';
            imageDisplay.src = `/api/file/${projectName}/${filePath}`;
            
            showStatus('Image loaded: ' + filePath);
        } else {
            // Show text editor
            const imageViewer = document.getElementById('imageViewer');
            const editorContainer = document.getElementById('editor');
            
            imageViewer.style.display = 'none';
            editorContainer.style.display = 'block';
            
            const response = await fetch(`/api/file/${projectName}/${filePath}`);
            const data = await response.json();
            
            if (data.error) {
                showStatus('Error: ' + data.error);
                return;
            }
            
            // Set editor mode based on file extension
            let mode = 'stex';
            if (ext === 'js') mode = 'javascript';
            else if (ext === 'css') mode = 'css';
            else if (ext === 'xml' || ext === 'html') mode = 'xml';
            else if (ext === 'tex') mode = 'stex';
            
            editor.setOption('mode', mode);
            editor.setValue(data.content);
            editor.refresh(); // Refresh to ensure proper sizing
            
            showStatus('File loaded: ' + filePath);
        }
    } catch (error) {
        showStatus('Error loading file: ' + error.message);
    }
}

// Save file
async function saveFile(isAutosave = false) {
    if (!currentProject || !currentFilePath) {
        if (!isAutosave) {
            showStatus('No file to save');
        }
        return;
    }
    
    if (isImageFile) {
        if (!isAutosave) {
            showStatus('Cannot save image files');
        }
        return;
    }
    
    try {
        const content = editor.getValue();
        const response = await fetch(`/api/file/${currentProject}/${currentFilePath}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        if (data.success) {
            if (!isAutosave) {
                showStatus('File saved successfully');
            } else {
                // Show a subtle indicator for autosave (optional - can be removed if too distracting)
                // showStatus('Auto-saved', 500);
            }
        } else {
            showStatus('Error saving file: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error saving file: ' + error.message);
    }
}

// Upload file to current directory
async function uploadFileToDirectory(files) {
    if (!currentProject) {
        showStatus('No project selected');
        return;
    }
    
    showStatus('Uploading files...');
    
    try {
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            if (currentDirectory) {
                formData.append('directory', currentDirectory);
            }
            
            const response = await fetch(`/api/upload_file/${currentProject}`, {
                method: 'POST',
                body: formData
            });
            
            // Check if response is OK
            if (!response.ok) {
                const text = await response.text();
                let errorMsg = `HTTP ${response.status}: `;
                try {
                    const json = JSON.parse(text);
                    errorMsg += json.error || 'Unknown error';
                } catch {
                    errorMsg += text.substring(0, 100);
                }
                showStatus('Error uploading ' + file.name + ': ' + errorMsg);
                return;
            }
            
            const data = await response.json();
            if (!data.success) {
                showStatus('Error uploading ' + file.name + ': ' + (data.error || 'Unknown error'));
                return;
            }
        }
        
        showStatus('Files uploaded successfully');
        // Refresh file tree to show uploaded files
        await loadFileTree(currentProject);
        await loadTexFiles(currentProject); // Refresh compile file dropdown
    } catch (error) {
        showStatus('Error uploading files: ' + error.message);
    }
}

// Create new file
async function createNewFile() {
    if (!currentProject) {
        showStatus('No project selected');
        return;
    }
    
    const fileName = document.getElementById('fileNameInput').value.trim();
    if (!fileName) {
        showStatus('File name cannot be empty');
        return;
    }
    
    showStatus('Creating file...');
    
    try {
        const response = await fetch(`/api/create_file/${currentProject}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: fileName,
                directory: currentDirectory || ''
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('File created successfully');
            await loadFileTree(currentProject);
            await loadTexFiles(currentProject); // Refresh compile file dropdown
            // Open the newly created file
            await loadFile(currentProject, data.path);
        } else {
            showStatus('Error creating file: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error creating file: ' + error.message);
    }
}

// Create new folder
async function createNewFolder() {
    if (!currentProject) {
        showStatus('No project selected');
        return;
    }
    
    const folderName = document.getElementById('folderNameInput').value.trim();
    if (!folderName) {
        showStatus('Folder name cannot be empty');
        return;
    }
    
    showStatus('Creating folder...');
    
    try {
        const response = await fetch(`/api/create_folder/${currentProject}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                directory: currentDirectory || ''
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Folder created successfully');
            await loadFileTree(currentProject);
            await loadTexFiles(currentProject); // Refresh compile file dropdown
        } else {
            showStatus('Error creating folder: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error creating folder: ' + error.message);
    }
}

// Compile LaTeX
async function compileLaTeX(cleanFirst = false) {
    if (!currentProject) {
        showStatus('No project selected');
        return;
    }
    
    // Get selected file from dropdown (needed for both clean and compile)
    const compileFile = document.getElementById('compileFileSelect').value;
    
    if (cleanFirst) {
        showStatus('Cleaning compilation files...');
        try {
            // Clean the project (removes all auxiliary files)
            const cleanResponse = await fetch(`/api/clean/${currentProject}`);
            const cleanData = await cleanResponse.json();
            
            if (cleanData.success) {
                const fileInfo = compileFile ? ` (for ${compileFile})` : '';
                showStatus(`Cleaned ${cleanData.count} file(s)${fileInfo}. Compiling...`);
            } else {
                showStatus('Warning: Clean failed, continuing with compilation...');
            }
        } catch (error) {
            showStatus('Warning: Clean error, continuing with compilation...');
        }
    } else {
        showStatus('Compiling...');
    }
    
    try {
        // Build compile URL with selected file
        let url = `/api/compile/${currentProject}`;
        if (compileFile) {
            url += `?file=${encodeURIComponent(compileFile)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            showStatus('Compilation successful');
            loadPDF(currentProject, data.pdf_path, data.synctex_path);
            // Display log even on success
            if (data.log) {
                displayCompilationLog(data.log, true);
            }
        } else {
            showStatus('Compilation failed: ' + (data.error || 'Unknown error'));
            if (data.log) {
                displayCompilationLog(data.log, false);
                console.error('Compilation log:', data.log);
            }
        }
    } catch (error) {
        showStatus('Error compiling: ' + error.message);
    }
}

// Clean and compile from scratch
async function compileClean() {
    // Clean and compile uses the same logic as regular compile
    // It will automatically use the selected file from the dropdown
    await compileLaTeX(true);
}

// Display compilation log in the log panel
function displayCompilationLog(log, isSuccess) {
    const logPanel = document.getElementById('logPanel');
    const logContent = document.getElementById('logContent');
    
    // Show the log panel if it's hidden
    if (logPanel.style.display === 'none') {
        logPanel.style.display = 'flex';
        // Make sure PDF panel adjusts
        const pdfPanel = document.getElementById('pdfPanel');
        if (pdfPanel && pdfPanel.style.display !== 'none') {
            // PDF panel will adjust automatically with flex
        }
    }
    
    // Remove collapsed class to ensure panel is visible
    logPanel.classList.remove('collapsed');
    
    // Format and display the log
    if (!log || log.trim() === '') {
        logContent.innerHTML = '<p class="empty-message">No log output</p>';
        logContent.className = 'log-content';
        return;
    }
    
    // Parse log sections
    const lines = log.split('\n');
    let html = '';
    let currentSection = '';
    let inError = false;
    let inWarning = false;
    
    lines.forEach((line, index) => {
        // Detect sections
        if (line.includes('===') && line.includes('===')) {
            if (currentSection) {
                html += '</div>';
            }
            currentSection = line.trim();
            html += `<div class="log-section"><strong>${escapeHtml(currentSection)}</strong><br>`;
            inError = false;
            inWarning = false;
        } else if (line.toLowerCase().includes('error') || line.includes('!') || line.includes('Fatal')) {
            if (!currentSection) {
                html += '<div class="log-section">';
            }
            html += `<div class="log-error">${escapeHtml(line)}</div>`;
            inError = true;
        } else if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('overfull') || line.toLowerCase().includes('underfull')) {
            if (!currentSection) {
                html += '<div class="log-section">';
            }
            html += `<div class="log-warning">${escapeHtml(line)}</div>`;
            inWarning = true;
        } else {
            if (currentSection && !currentSection.includes('===')) {
                html += escapeHtml(line) + '<br>';
            } else if (line.trim()) {
                if (!currentSection) {
                    html += '<div class="log-section">';
                }
                html += escapeHtml(line) + '<br>';
            }
        }
    });
    
    // Close last section
    if (currentSection) {
        html += '</div>';
    }
    
    logContent.innerHTML = html || '<p class="empty-message">No log output</p>';
    logContent.className = 'log-content' + (isSuccess ? ' success' : ' error');
    
    // Auto-scroll to bottom to show latest output
    logContent.scrollTop = logContent.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toggle log panel collapse
function toggleLogPanel() {
    const logPanel = document.getElementById('logPanel');
    const toggleBtn = document.getElementById('toggleLogPanelBtn');
    
    if (logPanel.classList.contains('collapsed')) {
        logPanel.classList.remove('collapsed');
        toggleBtn.textContent = '◀';
        toggleBtn.title = 'Collapse panel';
    } else {
        logPanel.classList.add('collapsed');
        toggleBtn.textContent = '▶';
        toggleBtn.title = 'Expand panel';
    }
}

// Clear compilation log
function clearCompilationLog() {
    const logContent = document.getElementById('logContent');
    logContent.innerHTML = '<p class="empty-message">No compilation log yet</p>';
    logContent.className = 'log-content';
}

// Load PDF with PDF.js for click-to-source mapping
let pdfDoc = null;
let currentPdfPath = null;
let currentSynctexPath = null;

async function loadPDF(projectName, pdfPath, synctexPath = null) {
    const viewer = document.getElementById('pdfViewer');
    currentPdfPath = pdfPath;
    currentSynctexPath = synctexPath;
    
    viewer.innerHTML = '<div style="padding: 20px; text-align: center;">Loading PDF...</div>';
    
    try {
        // Set PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // Load PDF
        const loadingTask = pdfjsLib.getDocument(`/api/pdf/${projectName}/${pdfPath}`);
        pdfDoc = await loadingTask.promise;
        
        // Render all pages in a scrollable container
        await renderAllPDFPages();
        
        // Add click handler for PDF
        viewer.addEventListener('click', handlePDFClick);
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        viewer.innerHTML = `<p class="empty-message">Error loading PDF: ${error.message}</p>`;
    }
}

// Render all PDF pages in a scrollable container
async function renderAllPDFPages() {
    const viewer = document.getElementById('pdfViewer');
    
    try {
        // Clear viewer
        viewer.innerHTML = '';
        
        // Create container for all pages
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; align-items: center; padding: 20px; background: #525252;';
        container.id = 'pdfContainer';
        
        const scale = 1.5;
        showStatus(`Rendering ${pdfDoc.numPages} pages...`);
        
        // Render all pages
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            
            // Create page container
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container';
            pageContainer.style.cssText = `
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                background: white;
                position: relative;
            `;
            pageContainer.dataset.pageNum = pageNum;
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.display = 'block';
            canvas.className = 'pdf-page-canvas';
            canvas.style.pointerEvents = 'none'; // Allow clicks to pass through to text layer
            
            // Render PDF page
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            
            // Add text layer for text selection
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                width: ${viewport.width}px;
                height: ${viewport.height}px;
                overflow: hidden;
                opacity: 0.2;
                line-height: 1.0;
                user-select: text;
                -webkit-user-select: text;
                -moz-user-select: text;
                -ms-user-select: text;
                pointer-events: auto;
                z-index: 2;
            `;
            
            // Render text layer for text selection
            const textContent = await page.getTextContent();
            
            // Render text items manually for better control
            textContent.items.forEach((item) => {
                if (!item.str || item.str.trim() === '') return;
                
                // Calculate transform - item.transform is already in PDF coordinates
                // We need to apply viewport scaling
                const itemTransform = item.transform || [1, 0, 0, 1, 0, 0];
                
                // Apply viewport scale to the transform
                const scaleX = viewport.transform ? viewport.transform[0] : scale;
                const scaleY = viewport.transform ? viewport.transform[3] : scale;
                
                // Calculate position and size
                const x = itemTransform[4] * scaleX;
                const y = itemTransform[5] * scaleY;
                const fontSize = Math.abs(itemTransform[0] * scaleX);
                
                const span = document.createElement('span');
                span.textContent = item.str;
                span.setAttribute('role', 'presentation');
                span.style.cssText = `
                    position: absolute;
                    left: ${x}px;
                    top: ${y}px;
                    font-size: ${fontSize}px;
                    font-family: ${item.fontName || 'sans-serif'};
                    transform: matrix(${itemTransform[0] * scaleX}, ${itemTransform[1] * scaleY}, ${itemTransform[2] * scaleX}, ${itemTransform[3] * scaleY}, 0, 0);
                    transform-origin: 0% 0%;
                    white-space: pre;
                    cursor: text;
                    color: transparent;
                `;
                textLayerDiv.appendChild(span);
            });
            
            // Add link layer for clickable links
            const linkService = {
                getDestinationHash: () => '',
                getAnchorUrl: () => '',
                navigateTo: (dest) => {
                    // Handle internal navigation
                    if (dest && dest.dest) {
                        // Try to resolve destination
                        pdfDoc.getDestination(dest.dest).then((destArray) => {
                            if (destArray && destArray[0]) {
                                pdfDoc.getPageIndex(destArray[0]).then((pageIndex) => {
                                    scrollToPDFPage(pageIndex + 1);
                                });
                            }
                        });
                    }
                },
                executeNamedAction: (action) => {
                    // Handle named actions
                },
                cachePageRef: () => {},
                isPageVisible: () => true,
                isPageCached: () => true
            };
            
            const linkDiv = document.createElement('div');
            linkDiv.className = 'linkLayer';
            linkDiv.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                width: ${viewport.width}px;
                height: ${viewport.height}px;
                pointer-events: auto;
                z-index: 3;
            `;
            
            // Get annotations (links)
            page.getAnnotations().then((annotations) => {
                if (annotations && annotations.length > 0) {
                    pdfjsLib.AnnotationLayer.render({
                        viewport: viewport,
                        div: linkDiv,
                        annotations: annotations,
                        linkService: linkService,
                        downloadManager: null,
                        annotationStorage: null
                    });
                }
            }).catch(err => {
                console.log('No annotations for page', pageNum);
            });
            
            // Handle link clicks
            linkDiv.addEventListener('click', (event) => {
                const link = event.target.closest('a');
                if (link) {
                    const url = link.href;
                    if (url && url.startsWith('http')) {
                        // External link - open in new tab
                        window.open(url, '_blank');
                        event.preventDefault();
                    } else if (url && url.startsWith('#')) {
                        // Internal reference - try to jump
                        event.preventDefault();
                        // Handle internal references
                        handlePDFReference(url);
                    }
                }
            });
            
            // Add page number label
            const pageLabel = document.createElement('div');
            pageLabel.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 12px;
                pointer-events: none;
                z-index: 5;
            `;
            pageLabel.textContent = `Page ${pageNum}`;
            
            // Append in correct order: canvas (background), then text layer (selectable), then links (clickable)
            pageContainer.appendChild(pageLabel);
            pageContainer.appendChild(canvas);
            pageContainer.appendChild(textLayerDiv);
            pageContainer.appendChild(linkDiv);
            
            // Make sure text layer is on top for selection
            textLayerDiv.style.zIndex = '2';
            linkDiv.style.zIndex = '3'; // Links should be on top
            
            // Track focus on PDF
            pageContainer.addEventListener('mousedown', () => {
                lastFocusedElement = 'pdf';
            });
            
            container.appendChild(pageContainer);
            
            // Update status
            if (pageNum % 5 === 0 || pageNum === pdfDoc.numPages) {
                showStatus(`Rendered ${pageNum} of ${pdfDoc.numPages} pages...`);
            }
        }
        
        viewer.appendChild(container);
        showStatus('PDF loaded successfully');
        
        // Store current page (start at page 1)
        viewer.dataset.currentPage = '1';
        
        // Initialize PDF search UI
        initPDFSearch();
        
    } catch (error) {
        console.error('Error rendering PDF pages:', error);
        viewer.innerHTML = `<p class="empty-message">Error rendering PDF: ${error.message}</p>`;
        showStatus('Error rendering PDF: ' + error.message);
    }
}

// Helper function to render a single page (for compatibility)
async function renderPDFPage(pageNum) {
    // Scroll to the requested page
    const viewer = document.getElementById('pdfViewer');
    const container = viewer.querySelector('#pdfContainer');
    if (!container) {
        // If container doesn't exist, render all pages
        await renderAllPDFPages();
        // Wait a bit for rendering, then scroll
        setTimeout(() => scrollToPDFPage(pageNum), 500);
        return;
    }
    
    scrollToPDFPage(pageNum);
}

// Scroll to a specific PDF page
function scrollToPDFPage(pageNum) {
    const viewer = document.getElementById('pdfViewer');
    const container = viewer.querySelector('#pdfContainer');
    if (!container) return;
    
    const pageContainer = container.querySelector(`[data-page-num="${pageNum}"]`);
    if (pageContainer) {
        pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        viewer.dataset.currentPage = pageNum.toString();
        
        // Highlight the page briefly
        pageContainer.style.outline = '3px solid rgba(255, 255, 0, 0.8)';
        setTimeout(() => {
            pageContainer.style.outline = '';
        }, 2000);
    }
}

// Make goToPDFPage available globally
window.goToPDFPage = async function(pageNum) {
    await renderPDFPage(pageNum);
};

async function handlePDFClick(event) {
    if (!currentPdfPath || !pdfDoc) return;
    
    const canvas = event.target.closest('canvas');
    if (!canvas) return;
    
    // Find which page this canvas belongs to
    const pageContainer = canvas.closest('.pdf-page-container');
    if (!pageContainer) return;
    
    const pageNum = parseInt(pageContainer.dataset.pageNum || '1');
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert canvas coordinates to PDF coordinates
    const scale = 1.5;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    
    const pdfX = (x / canvas.width) * viewport.width;
    const pdfY = viewport.height - (y / canvas.height) * viewport.height; // PDF Y is bottom-up
    
    // Resolve to source file
    try {
        showStatus('Resolving PDF location...');
        const response = await fetch(`/api/synctex/${currentProject}/resolve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                page: pageNum,
                x: pdfX,
                y: pdfY
            })
        });
        
        const data = await response.json();
        if (data.success && data.file) {
            // Load the file and jump to the line
            await loadFileAndJumpToLine(currentProject, data.file, data.line || 1);
            showStatus(`Jumped to ${data.file}:${data.line}`);
        } else {
            showStatus('Could not resolve PDF location: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error resolving SyncTeX:', error);
        showStatus('Error resolving PDF location: ' + error.message);
    }
}

async function loadFileAndJumpToLine(projectName, filePath, lineNumber) {
    // Load the file if not already loaded
    if (currentFilePath !== filePath) {
        await loadFile(projectName, filePath);
    }
    
    // Jump to line in CodeMirror
    if (editor) {
        editor.setCursor(lineNumber - 1, 0);
        editor.scrollIntoView({ line: lineNumber - 1, ch: 0 }, 100);
        editor.focus();
        
        // Highlight the line briefly
        const lineHandle = editor.getLineHandle(lineNumber - 1);
        editor.addLineClass(lineNumber - 1, 'background', 'highlight-line');
        setTimeout(() => {
            editor.removeLineClass(lineNumber - 1, 'background', 'highlight-line');
        }, 2000);
    }
}

// Handle PDF reference clicks (internal references like \ref, \cite)
function handlePDFReference(refUrl) {
    // Extract reference name from URL (e.g., #ref:section1)
    const refName = refUrl.replace('#', '').replace('ref:', '');
    
    // Try to find this reference in the source files
    if (currentProject) {
        // Search for \label{refName} or similar in all .tex files
        findReferenceInSource(refName);
    }
}

// Find reference in source files
async function findReferenceInSource(refName) {
    try {
        // Get all .tex files in the project
        const response = await fetch(`/api/projects/${currentProject}/tex_files`);
        const data = await response.json();
        
        if (data.tex_files) {
            // Search through all .tex files
            for (const texFile of data.tex_files) {
                const fileResponse = await fetch(`/api/file/${currentProject}/${texFile.path}`);
                const fileData = await fileResponse.json();
                
                if (fileData.content) {
                    // Look for \label{refName} or \ref{refName}
                    const labelPattern = new RegExp(`\\\\label\\{${refName}\\}`, 'i');
                    const lines = fileData.content.split('\n');
                    
                    for (let i = 0; i < lines.length; i++) {
                        if (labelPattern.test(lines[i])) {
                            // Found the label, load the file and jump to line
                            await loadFileAndJumpToLine(currentProject, texFile.path, i + 1);
                            showStatus(`Found reference "${refName}" in ${texFile.path}:${i + 1}`);
                            return;
                        }
                    }
                }
            }
            showStatus(`Reference "${refName}" not found in source files`);
        }
    } catch (error) {
        console.error('Error finding reference:', error);
        showStatus('Error finding reference: ' + error.message);
    }
}

// PDF search functionality
let pdfSearchResults = [];
let currentPdfSearchIndex = -1;

function initPDFSearch() {
    // Add search UI to PDF header
    const pdfHeader = document.querySelector('.pdf-header');
    if (!pdfHeader) return;
    
    // Check if search UI already exists
    if (document.getElementById('pdfSearchBox')) return;
    
    const searchContainer = document.createElement('div');
    searchContainer.id = 'pdfSearchContainer';
    searchContainer.style.cssText = 'display: flex; align-items: center; gap: 5px; margin-left: 10px;';
    
    const searchInput = document.createElement('input');
    searchInput.id = 'pdfSearchBox';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search in PDF...';
    searchInput.style.cssText = 'padding: 5px 10px; border: 1px solid #3e3e3e; background: #1e1e1e; color: #ccc; border-radius: 3px; width: 200px;';
    
    const searchPrev = document.createElement('button');
    searchPrev.textContent = '↑';
    searchPrev.className = 'btn btn-small';
    searchPrev.title = 'Previous';
    searchPrev.onclick = () => navigatePDFSearch(-1);
    
    const searchNext = document.createElement('button');
    searchNext.textContent = '↓';
    searchNext.className = 'btn btn-small';
    searchNext.title = 'Next';
    searchNext.onclick = () => navigatePDFSearch(1);
    
    const searchClose = document.createElement('button');
    searchClose.textContent = '×';
    searchClose.className = 'btn btn-small';
    searchClose.title = 'Close';
    searchClose.onclick = () => closePDFSearch();
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchPrev);
    searchContainer.appendChild(searchNext);
    searchContainer.appendChild(searchClose);
    pdfHeader.appendChild(searchContainer);
    
    searchInput.addEventListener('input', (e) => {
        searchPDF(e.target.value);
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                navigatePDFSearch(-1);
            } else {
                navigatePDFSearch(1);
            }
        } else if (e.key === 'Escape') {
            closePDFSearch();
        }
    });
}

// Search in PDF
async function searchPDF(query) {
    if (!pdfDoc || !query.trim()) {
        clearPDFSearchHighlights();
        return;
    }
    
    pdfSearchResults = [];
    currentPdfSearchIndex = -1;
    
    // Search through all pages
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const items = textContent.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.str && item.str.toLowerCase().includes(query.toLowerCase())) {
                pdfSearchResults.push({
                    page: pageNum,
                    text: item.str,
                    transform: item.transform,
                    index: i
                });
            }
        }
    }
    
    if (pdfSearchResults.length > 0) {
        showStatus(`Found ${pdfSearchResults.length} matches`);
        navigatePDFSearch(1);
    } else {
        showStatus('No matches found');
        clearPDFSearchHighlights();
    }
}

// Navigate PDF search results
function navigatePDFSearch(direction) {
    if (pdfSearchResults.length === 0) return;
    
    currentPdfSearchIndex += direction;
    if (currentPdfSearchIndex < 0) {
        currentPdfSearchIndex = pdfSearchResults.length - 1;
    } else if (currentPdfSearchIndex >= pdfSearchResults.length) {
        currentPdfSearchIndex = 0;
    }
    
    const result = pdfSearchResults[currentPdfSearchIndex];
    highlightPDFSearchResult(result);
    showStatus(`Match ${currentPdfSearchIndex + 1} of ${pdfSearchResults.length}`);
}

// Highlight PDF search result
function highlightPDFSearchResult(result) {
    clearPDFSearchHighlights();
    
    // Scroll to the page
    scrollToPDFPage(result.page);
    
    // Find the text layer element for this page
    const container = document.getElementById('pdfContainer');
    if (!container) return;
    
    const pageContainer = container.querySelector(`[data-page-num="${result.page}"]`);
    if (!pageContainer) return;
    
    const textLayer = pageContainer.querySelector('.textLayer');
    if (!textLayer) return;
    
    // Highlight the matching text
    const spans = textLayer.querySelectorAll('span');
    if (spans[result.index]) {
        spans[result.index].style.backgroundColor = 'yellow';
        spans[result.index].style.color = 'black';
        spans[result.index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Clear PDF search highlights
function clearPDFSearchHighlights() {
    const textLayers = document.querySelectorAll('.textLayer span');
    textLayers.forEach(span => {
        span.style.backgroundColor = '';
        span.style.color = '';
    });
}

// Close PDF search
function closePDFSearch() {
    const searchContainer = document.getElementById('pdfSearchContainer');
    if (searchContainer) {
        searchContainer.style.display = 'none';
    }
    clearPDFSearchHighlights();
    pdfSearchActive = false;
}

// Handle triple-click in editor to highlight PDF
async function handleEditorTripleClick() {
    if (!currentProject || !currentFilePath || !pdfDoc || !currentPdfPath) {
        showStatus('PDF not loaded or no file open');
        return;
    }
    
    if (!editor) return;
    
    const cursor = editor.getCursor();
    const line = cursor.line + 1; // 1-indexed
    const filePath = currentFilePath;
    
    // Only work for .tex files
    if (!filePath.endsWith('.tex')) {
        showStatus('PDF highlighting only works for LaTeX files');
        return;
    }
    
    try {
        showStatus('Finding location in PDF...');
        // Resolve source line to PDF coordinates
        const response = await fetch(`/api/synctex/${currentProject}/resolve_reverse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: filePath,
                line: line,
                column: 1
            })
        });
        
        const data = await response.json();
        if (data.success && data.page) {
            // Navigate to the page and highlight
            await highlightPDFLocation(data.page, data.x, data.y);
            showStatus(`Highlighted location on page ${data.page}`);
        } else {
            showStatus('Could not find corresponding location in PDF: ' + (data.error || 'Location not found'));
        }
    } catch (error) {
        console.error('Error resolving reverse SyncTeX:', error);
        showStatus('Error finding PDF location: ' + error.message);
    }
}

// Highlight location in PDF
async function highlightPDFLocation(pageNum, x, y) {
    const viewer = document.getElementById('pdfViewer');
    
    // Scroll to the page if needed
    scrollToPDFPage(pageNum);
    
    // Wait a bit for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Find the canvas for this page
    const container = viewer.querySelector('#pdfContainer');
    if (!container) return;
    
    const pageContainer = container.querySelector(`[data-page-num="${pageNum}"]`);
    if (!pageContainer) return;
    
    const canvas = pageContainer.querySelector('canvas');
    if (!canvas) return;
    
    const page = await pdfDoc.getPage(pageNum);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    // Convert PDF coordinates to canvas coordinates
    const canvasX = (x / viewport.width) * canvas.width;
    const canvasY = canvas.height - (y / viewport.height) * canvas.height; // PDF Y is bottom-up
    
    // Create a highlight overlay on the page container
    let highlightOverlay = pageContainer.querySelector('.pdf-highlight');
    if (!highlightOverlay) {
        highlightOverlay = document.createElement('div');
        highlightOverlay.className = 'pdf-highlight';
        highlightOverlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            background: rgba(255, 255, 0, 0.3);
            border: 2px solid rgba(255, 255, 0, 0.8);
            border-radius: 3px;
            z-index: 10;
        `;
        pageContainer.style.position = 'relative';
        pageContainer.appendChild(highlightOverlay);
    }
    
    // Position and size the highlight
    const highlightSize = 50; // Size of highlight box
    highlightOverlay.style.left = (canvasX - highlightSize/2) + 'px';
    highlightOverlay.style.top = (canvasY - highlightSize/2) + 'px';
    highlightOverlay.style.width = highlightSize + 'px';
    highlightOverlay.style.height = highlightSize + 'px';
    highlightOverlay.style.display = 'block';
    
    // Scroll to the highlight
    pageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
        if (highlightOverlay) {
            highlightOverlay.style.display = 'none';
        }
    }, 3000);
}

// Upload file
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    showStatus('Uploading...');
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Upload successful');
            await loadProjects();
            // Navigate to project URL
            window.location.href = `/project/${encodeURIComponent(data.project_name)}`;
        } else {
            showStatus('Upload failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error uploading: ' + error.message);
    }
}

// Open directory
async function openDirectory(path) {
    showStatus('Opening directory...');
    
    try {
        const response = await fetch('/api/open_directory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path })
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Directory opened successfully');
            await loadProjects();
            // Navigate to project URL
            window.location.href = `/project/${encodeURIComponent(data.project_name)}`;
        } else {
            showStatus('Failed to open directory: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        showStatus('Error opening directory: ' + error.message);
    }
}

// Show status message
function showStatus(message) {
    document.getElementById('statusMessage').textContent = message;
}

// Global keyboard shortcuts - use capture phase to catch before CodeMirror
document.addEventListener('keydown', (e) => {
    // Don't handle if we're typing in an input/textarea (unless it's our search input)
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isEditorSearchInput = target.id === 'editorSearchInput';
    
    // Ctrl+F for search
    if (e.ctrlKey && (e.key === 'f' || e.key === 'F') && !e.shiftKey && !e.altKey) {
        // If we're in the editor search input, let its handler deal with it
        if (isEditorSearchInput) {
            return; // The input's handler will deal with it
        }
        
        // Check if we're in CodeMirror editor area
        const isInCodeMirror = target.closest('.CodeMirror') || target.closest('#editor');
        
        // If in editor area, handle editor search
        if (isInCodeMirror && editor) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Global handler: Intercepting Ctrl+F for editor search');
            toggleEditorSearch(editor);
            lastFocusedElement = 'editor';
            return;
        }
        
        // Check for PDF area
        if (lastFocusedElement === 'pdf' || (e.target.closest('#pdfViewer') && !e.target.closest('#editor'))) {
            e.preventDefault();
            // PDF is focused
            if (!pdfSearchActive) {
                initPDFSearch();
                const searchBox = document.getElementById('pdfSearchBox');
                if (searchBox) {
                    searchBox.style.display = 'block';
                    searchBox.focus();
                    pdfSearchActive = true;
                }
            } else {
                const searchBox = document.getElementById('pdfSearchBox');
                if (searchBox) {
                    searchBox.focus();
                    searchBox.select();
                }
            }
        } else {
            // Editor is focused (default) or anywhere else in editor area
            // Check if we're in the editor container area (but not in a regular input)
            const isInEditorArea = target.closest('#editor') || target.closest('.CodeMirror') || 
                                  (!isInput || target.closest('.editor-search-container'));
            
            // If we're in editor area or CodeMirror, or if editor exists and we're not in a regular input
            if (editor && (isInEditorArea || target.closest('.CodeMirror') || (!isInput && !target.closest('#pdfViewer')))) {
                console.log('Global handler: Opening editor search');
                toggleEditorSearch(editor);
                lastFocusedElement = 'editor';
            }
        }
        return;
    }
    
    // Escape to close search
    if (e.key === 'Escape' && !isInput) {
        if (pdfSearchActive) {
            closePDFSearch();
        } else if (editorSearchActive) {
            closeEditorSearch();
        }
    }
});

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    initSidePanelResizer();
    loadProjects();
    updateDownloadButton(); // Initialize download button state
    
    // Upload button
    document.getElementById('uploadBtn').addEventListener('click', () => {
        document.getElementById('uploadModal').style.display = 'block';
    });
    
    // Open directory button
    document.getElementById('openDirBtn').addEventListener('click', () => {
        document.getElementById('dirModal').style.display = 'block';
    });
    
    // Create project button
    document.getElementById('createProjectBtn').addEventListener('click', () => {
        document.getElementById('createProjectModal').style.display = 'block';
        document.getElementById('projectNameInput').focus();
    });
    
    // Create project modal
    const createProjectModal = document.getElementById('createProjectModal');
    document.getElementById('createProjectSubmitBtn').addEventListener('click', () => {
        const projectName = document.getElementById('projectNameInput').value.trim();
        if (projectName) {
            createProject(projectName);
            createProjectModal.style.display = 'none';
            document.getElementById('projectNameInput').value = '';
        }
    });
    
    // Allow Enter key to submit in create project modal
    document.getElementById('projectNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('createProjectSubmitBtn').click();
        }
    });
    
    // Project select
    document.getElementById('projectSelect').addEventListener('change', async (e) => {
        currentProject = e.target.value;
        setUploadTarget('');
        if (currentProject) {
            // Navigate to project URL
            window.location.href = `/project/${encodeURIComponent(currentProject)}`;
        } else {
            showHomeView();
            document.getElementById('fileTree').innerHTML = '<p class="empty-message">No project loaded</p>';
            editor.setValue('');
            document.getElementById('currentFile').textContent = 'No file selected';
            document.getElementById('pdfViewer').innerHTML = '<p class="empty-message">No PDF available</p>';
            document.getElementById('imageViewer').style.display = 'none';
            document.getElementById('editor').style.display = 'block';
            document.getElementById('compileFileSelect').style.display = 'none';
            document.getElementById('compileFileSelect').innerHTML = '<option value="">Auto-detect</option>';
            updateUploadButton();
            updateDownloadButton();
        }
    });
    
    // Download button
    document.getElementById('downloadBtn').addEventListener('click', () => {
        if (currentProject) {
            window.location.href = `/api/download/${currentProject}`;
        }
    });
    
    // Home button
    document.getElementById('homeBtn').addEventListener('click', () => {
        currentProject = null;
        document.getElementById('projectSelect').value = '';
        // Navigate to home URL
        window.location.href = '/';
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.project) {
            // Opening a project from history
            openProject(e.state.project, true);
        } else {
            // Going back to home
            currentProject = null;
            document.getElementById('projectSelect').value = '';
            showHomeView(true);
            updateUploadButton();
            updateDownloadButton();
        }
    });
    
    // Check URL on page load to restore project state
    async function loadProjectFromURL() {
        const path = window.location.pathname;
        const projectMatch = path.match(/^\/project\/(.+)$/);
        if (projectMatch) {
            const projectName = decodeURIComponent(projectMatch[1]);
            // Load project from URL
            openProject(projectName, true);
            
            // Wait for project to load, then recompile on refresh
            setTimeout(async () => {
                if (currentProject === projectName) {
                    try {
                        // Always recompile on refresh to ensure latest PDF
                        showStatus('Auto-compiling on page load...');
                        await compileLaTeX(false);
                    } catch (error) {
                        console.log('Auto-compilation on refresh failed:', error);
                        // Don't show error to user, just log it
                    }
                }
            }, 1500); // Wait for everything to load
        } else {
            // On home page
            showHomeView(true);
        }
    }
    
    // Load project from URL on initial page load
    loadProjectFromURL();
    
    // Upload file button
    document.getElementById('uploadFileBtn').addEventListener('click', () => {
        document.getElementById('fileUploadInput').click();
    });
    
    // New file button
    document.getElementById('newFileBtn').addEventListener('click', () => {
        document.getElementById('createFileModal').style.display = 'block';
        document.getElementById('fileNameInput').focus();
        document.getElementById('fileNameInput').value = '';
    });
    
    // New folder button
    document.getElementById('newFolderBtn').addEventListener('click', () => {
        document.getElementById('createFolderModal').style.display = 'block';
        document.getElementById('folderNameInput').focus();
        document.getElementById('folderNameInput').value = '';
    });
    
    // Create file modal
    const createFileModal = document.getElementById('createFileModal');
    document.getElementById('createFileSubmitBtn').addEventListener('click', () => {
        createNewFile();
        createFileModal.style.display = 'none';
        document.getElementById('fileNameInput').value = '';
    });
    
    // Allow Enter key to submit in create file modal
    document.getElementById('fileNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('createFileSubmitBtn').click();
        }
    });
    
    // Create folder modal
    const createFolderModal = document.getElementById('createFolderModal');
    document.getElementById('createFolderSubmitBtn').addEventListener('click', () => {
        createNewFolder();
        createFolderModal.style.display = 'none';
        document.getElementById('folderNameInput').value = '';
    });
    
    // Allow Enter key to submit in create folder modal
    document.getElementById('folderNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('createFolderSubmitBtn').click();
        }
    });
    
    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
        saveFile(false); // Manual save
    });
    
    // Editor search controls
    const editorSearchInput = document.getElementById('editorSearchInput');
    const editorSearchNextBtn = document.getElementById('editorSearchNextBtn');
    const editorSearchPrevBtn = document.getElementById('editorSearchPrevBtn');
    const editorSearchCloseBtn = document.getElementById('editorSearchCloseBtn');
    const editorSearchCaseBtn = document.getElementById('editorSearchCaseBtn');
    const editorSearchRegexBtn = document.getElementById('editorSearchRegexBtn');
    
    if (editorSearchInput) {
        editorSearchInput.addEventListener('input', (e) => {
            // Prevent focus from being stolen - stop all propagation
            e.stopPropagation();
            e.stopImmediatePropagation();
            performEditorSearch(e.target.value);
        });
        
        editorSearchInput.addEventListener('keydown', (e) => {
            // Stop all keydown events from propagating to CodeMirror/editor
            e.stopPropagation();
            
            // Handle Ctrl+F to toggle search (even when input is focused)
            if (e.ctrlKey && e.key === 'f' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                toggleEditorSearch(editor);
                return;
            }
            
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    navigateEditorSearch(-1); // Previous
                } else {
                    navigateEditorSearch(1); // Next
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeEditorSearch();
            }
            // For all other keys, stop propagation so editor doesn't capture them
        });
        
        // Prevent focus loss when clicking in the input
        editorSearchInput.addEventListener('focus', (e) => {
            e.stopPropagation();
            console.log('Search input focused');
        });
        
        editorSearchInput.addEventListener('blur', (e) => {
            // Only allow blur if we're explicitly closing the search
            // Otherwise, prevent blur to keep focus on input
            if (!e.relatedTarget || !e.relatedTarget.closest('.editor-search-container')) {
                console.log('Search input blur prevented');
                // Don't allow blur unless we're closing search
                setTimeout(() => {
                    if (editorSearchActive && searchContainer.style.display === 'flex') {
                        editorSearchInput.focus();
                    }
                }, 10);
            }
        });
    }
    
    if (editorSearchNextBtn) {
        editorSearchNextBtn.addEventListener('click', () => {
            navigateEditorSearch(1);
        });
    }
    
    if (editorSearchPrevBtn) {
        editorSearchPrevBtn.addEventListener('click', () => {
            navigateEditorSearch(-1);
        });
    }
    
    if (editorSearchCloseBtn) {
        editorSearchCloseBtn.addEventListener('click', () => {
            closeEditorSearch();
        });
    }
    
    // Case sensitivity toggle
    if (editorSearchCaseBtn) {
        editorSearchCaseBtn.addEventListener('click', () => {
            editorSearchCaseSensitive = !editorSearchCaseSensitive;
            editorSearchCaseBtn.classList.toggle('active', editorSearchCaseSensitive);
            // Re-perform search with new case sensitivity
            if (editorSearchQuery) {
                performEditorSearch(editorSearchQuery);
            }
        });
    }
    
    // Regex mode toggle
    if (editorSearchRegexBtn) {
        editorSearchRegexBtn.addEventListener('click', () => {
            editorSearchRegexMode = !editorSearchRegexMode;
            editorSearchRegexBtn.classList.toggle('active', editorSearchRegexMode);
            // Re-perform search with new regex mode
            if (editorSearchQuery) {
                performEditorSearch(editorSearchQuery);
            }
        });
    }
    
    // Autosave checkbox
    document.getElementById('autosaveCheckbox').addEventListener('change', (e) => {
        autosaveEnabled = e.target.checked;
        // Clear any pending autosave when disabling
        if (!autosaveEnabled && autosaveTimeout) {
            clearTimeout(autosaveTimeout);
            autosaveTimeout = null;
        }
        // Save current state to localStorage
        localStorage.setItem('autosaveEnabled', autosaveEnabled);
    });
    
    // Load autosave preference from localStorage
    const savedAutosave = localStorage.getItem('autosaveEnabled');
    if (savedAutosave === 'true') {
        autosaveEnabled = true;
        document.getElementById('autosaveCheckbox').checked = true;
    }
    
    // File upload input
    document.getElementById('fileUploadInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFileToDirectory(Array.from(e.target.files));
            e.target.value = '';
        }
    });
    
    // Drag and drop for file tree
    const fileTree = document.getElementById('fileTree');
    let dragTarget = null;
    
    fileTree.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileTree.classList.add('drag-over');
        
        // Highlight target directory
        const target = e.target.closest('.file-item');
        if (target && target !== dragTarget) {
            if (dragTarget) {
                dragTarget.classList.remove('drag-target');
            }
            if (target.dataset.type === 'directory' || target.dataset.dir !== undefined) {
                dragTarget = target;
                target.classList.add('drag-target');
            }
        }
    });
    
    fileTree.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!fileTree.contains(e.relatedTarget)) {
            fileTree.classList.remove('drag-over');
            if (dragTarget) {
                dragTarget.classList.remove('drag-target');
                dragTarget = null;
            }
        }
    });
    
    fileTree.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileTree.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            // Determine target directory from drop location
            const target = e.target.closest('.file-item');
            let targetDir = '';
            let targetItem = null;
            
            if (target) {
                if (target.dataset.type === 'directory') {
                    // Dropped on a directory - upload to that directory
                    targetDir = target.dataset.path;
                    targetItem = target;
                } else {
                    // Dropped on a file - upload to its parent directory
                    targetDir = target.dataset.dir || '';
                    targetItem = target;
                }
            } else {
                // Dropped on empty space, use root
                targetDir = '';
            }
            
            setUploadTarget(targetDir, targetItem);
            
            if (dragTarget) {
                dragTarget.classList.remove('drag-target');
                dragTarget = null;
            }
            
            await uploadFileToDirectory(files);
        }
    });
    
    // Allow dropping on the side panel header area (root directory)
    const sidePanel = document.querySelector('.side-panel');
    sidePanel.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    sidePanel.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && !e.target.closest('.file-tree')) {
            setUploadTarget('');
            await uploadFileToDirectory(files);
        }
    });
    
    // Compile button
    document.getElementById('compileBtn').addEventListener('click', () => compileLaTeX(false));
    document.getElementById('compileCleanBtn').addEventListener('click', compileClean);
    
    // Log panel controls
    document.getElementById('toggleLogPanelBtn').addEventListener('click', toggleLogPanel);
    document.getElementById('clearLogBtn').addEventListener('click', clearCompilationLog);
    
    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveFile);
    
    // Refresh PDF button - recompiles and reloads PDF
    document.getElementById('refreshPdfBtn').addEventListener('click', () => {
        if (currentProject) {
            compileLaTeX();
        }
    });
    
    // Upload modal
    const uploadModal = document.getElementById('uploadModal');
    document.getElementById('uploadSubmitBtn').addEventListener('click', () => {
        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length > 0) {
            uploadFile(fileInput.files[0]);
            uploadModal.style.display = 'none';
            fileInput.value = '';
        }
    });
    
    // Directory modal
    const dirModal = document.getElementById('dirModal');
    document.getElementById('dirSubmitBtn').addEventListener('click', () => {
        const dirInput = document.getElementById('dirInput');
        if (dirInput.value.trim()) {
            openDirectory(dirInput.value.trim());
            dirModal.style.display = 'none';
            dirInput.value = '';
        }
    });
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            modal.style.display = 'none';
            // Clear inputs
            if (modal.id === 'createProjectModal') {
                document.getElementById('projectNameInput').value = '';
            } else if (modal.id === 'createFileModal') {
                document.getElementById('fileNameInput').value = '';
            } else if (modal.id === 'createFolderModal') {
                document.getElementById('folderNameInput').value = '';
            }
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            // Clear inputs when clicking outside
            if (e.target.id === 'createFileModal') {
                document.getElementById('fileNameInput').value = '';
            } else if (e.target.id === 'createFolderModal') {
                document.getElementById('folderNameInput').value = '';
            }
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveFile();
        }
    });
});

