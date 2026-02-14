/* --- PUBLIC SITE LOGIC --- */
async function loadPublic() {
    const dateInput = document.getElementById('publicDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const container = document.getElementById('publicGrid');
    
    container.innerHTML = '<p>Loading...</p>';

    try {
        const res = await fetch(`/api/GetDailyVaak?date=${date}`);
        
        // If API fails (e.g. 500 Error), throw an error
        if (!res.ok) {
            throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        window.publicData = data; 
        renderPublic(data);
        populateFilter(data);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="color:red; padding:20px; border:1px solid red;">
            <strong>System Error:</strong> ${e.message}<br>
            <small>Please check the Browser Console (F12) and Azure Configuration.</small>
        </div>`;
    }
}

function renderPublic(data) {
    const filter = document.getElementById('gurudwaraFilter').value.toLowerCase();
    const container = document.getElementById('publicGrid');
    container.innerHTML = '';
    
    const filtered = (filter === 'all') ? data : data.filter(i => i.gurudwaraName.toLowerCase() === filter);

    if(filtered.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No Vaak published for this selection.</p>';
        return;
    }

    filtered.forEach(item => {
        container.innerHTML += `
            <div class="card">
                <span class="tag">${item.gurudwaraName}</span>
                <span class="meta" style="float:right">${item.gurudwaraLocation}</span>
                <p class="gurmukhi">${item.verse}</p>
                <div class="meta">
                    <strong>Page:</strong> ${item.pageNumber} <br>
                    <small>Editor: ${item.editorName}</small>
                </div>
            </div>
        `;
    });
}

function populateFilter(data) {
    const select = document.getElementById('gurudwaraFilter');
    // Keep "All" option, clear rest
    select.innerHTML = '<option value="all">All Gurudwaras</option>'; 
    
    const uniques = [...new Set(data.map(i => i.gurudwaraName))];
    uniques.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.toLowerCase();
        opt.innerText = g;
        select.appendChild(opt);
    });
}

/* --- ADMIN LOGIC --- */
async function initAdmin() {
    // 1. Check Authentication
    const res = await fetch('/.auth/me');
    const auth = await res.json();
    const user = auth.clientPrincipal;

    if (!user) {
        window.location.href = "/.auth/login/aad"; // Force Login
        return;
    }

    document.getElementById('userDisplay').innerText = `User: ${user.userDetails}`;

    // 2. Show Super Admin Tabs if authorized
    if (user.userRoles.includes('super_admin')) {
        document.querySelectorAll('.super-admin-only').forEach(el => el.classList.remove('hidden'));
    }
}

// LIBRARY: Search
async function searchLibrary() {
    const kw = document.getElementById('libSearch').value;
    const resultsContainer = document.getElementById('libResults');
    
    if (kw.length < 1) {
        resultsContainer.innerHTML = '<p>Please enter a page number or keyword.</p>';
        return;
    }

    resultsContainer.innerHTML = '<p>Searching library...</p>';

    try {
        // Updated to use the working LibraryManager API
        const res = await fetch(`/api/LibraryManager?keyword=${encodeURIComponent(kw)}`);
        if (!res.ok) throw new Error("Search failed");
        
        const data = await res.json();
        
        if (data.length === 0) {
            resultsContainer.innerHTML = '<p>No matching verses found in the library.</p>';
            return;
        }

        resultsContainer.innerHTML = data.map(item => `
            <div class="card" style="margin-bottom: 15px; border-left: 5px solid #2c3e50;">
                <strong>Page: ${item.pageNumber}</strong>
                <p class="gurmukhi" style="font-size: 1.3rem; margin: 10px 0;">${item.verse}</p>
                <p class="meta">Keywords: ${item.keywords}</p>
                <button class="btn-success" onclick='publishVaak(event, ${JSON.stringify(item).replace(/'/g, "&#39;")})'>
                    Publish to Homepage
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error("Search failed:", e);
        resultsContainer.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
    }
}

// EDITOR: Publish
async function publishVaak(event, item) {
    const btn = event.target; // Now this will work!
    const date = document.getElementById('publishDate').value;
    
    if (!date) {
        alert("Please select a date first.");
        return;
    }

    if (!confirm(`Are you sure you want to publish this for ${date}?`)) return;

    const originalText = btn.innerText;
    btn.innerText = "Publishing...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/EditorPublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verseItem: item, date: date })
        });

        const msg = await res.text();
        if (res.ok) {
            alert("✅ " + msg);
        } else {
            alert("❌ " + msg);
        }
    } catch (e) {
        alert("❌ Error: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
// SUPER ADMIN: Add Editor
async function saveEditor() {
    const editor = {
        email: document.getElementById('edEmail').value,
        firstName: document.getElementById('edFn').value,
        lastName: document.getElementById('edLn').value,
        gurudwaraName: document.getElementById('edGn').value,
        gurudwaraLocation: document.getElementById('edLoc').value,
        comments: document.getElementById('edCom').value
    };

    const res = await fetch('/api/AdminEditors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor)
    });

    if(res.ok) {
        alert("Editor profile saved.");
    } else {
        alert("Error saving editor.");
    }
}

// SUPER ADMIN: Bulk Import
async function bulkImport() {
    const jsonText = document.getElementById('bulkJson').value;
    try {
        const json = JSON.parse(jsonText);
        const res = await fetch('/api/AdminLibrary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json)
        });
        alert(await res.text());
    } catch (e) {
        alert("Invalid JSON format");
    }
}

async function loadLibraryTable() {
    const tableBody = document.getElementById('libraryTableBody');
    const searchVal = document.getElementById('libAdminSearch').value.trim(); // Get search text
    
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Searching...</td></tr>';

    try {
        // Build URL: if searchVal exists, append it as a query string
        const url = searchVal 
            ? `/api/LibraryManager?keyword=${encodeURIComponent(searchVal)}` 
            : `/api/LibraryManager`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        
        const data = await response.json();

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No records found.</td></tr>';
            return;
        }

        // Render the table rows
        tableBody.innerHTML = data.map(item => `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${item.pageNumber}</td>
                <td class="gurmukhi" style="padding: 10px; border: 1px solid #ddd;">${item.verse}</td>
                <td style="padding: 10px; border: 1px solid #ddd; font-size:0.8em; color:gray;">${item.keywords}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align:center;">
                    <button class="btn-danger" style="padding: 2px 8px;" onclick="deleteLibraryItem('${item.id}', '${item.pageNumber}')">Delete</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">${e.message}</td></tr>`;
    }
}

// Add the Delete Function to app.js
async function deleteLibraryItem(id, pageNumber) {
    if (!confirm("Are you sure you want to delete this verse from the library?")) return;

    try {
        const res = await fetch(`/api/AdminLibrary?id=${id}&page=${pageNumber}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert("Deleted successfully");
            loadLibraryTable(); // Refresh the table
        } else {
            alert("Delete failed: " + await res.text());
        }
    } catch (e) {
        alert("Error deleting: " + e.message);
    }
}

function openTab(name) {
    console.log("Switching to tab:", name);
    document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(name);
    if(target) target.classList.add('active');

    // NEW: If switching to library tab, load the data automatically
    if(name === 'libraryTab') {
        loadLibraryTable();
    }
}
window.loadLibraryTable = loadLibraryTable;
window.deleteLibraryItem = deleteLibraryItem;
window.searchLibrary = searchLibrary;
window.publishVaak = publishVaak;
window.saveEditor = saveEditor;
window.bulkImport = bulkImport;
window.openTab = openTab;
window.loadPublic = loadPublic;
