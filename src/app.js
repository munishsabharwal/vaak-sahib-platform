/* --- PUBLIC SITE LOGIC --- */
// 1. Add this variable at the very top of your app.js file
let lastFetchedData = []; 

// 2. Updated loadPublic function
async function loadPublic() {
    const dateInput = document.getElementById('publicDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const container = document.getElementById('publicGrid');
    
    container.innerHTML = '<div class="loading">Loading daily Vaaks...</div>';

    try {
        const res = await fetch(`/api/GetDailyVaak?date=${date}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const data = await res.json();
        
        // Save the data globally so the checkbox can access it without another API call
        lastFetchedData = data; 
        
        renderPublic(data);
        
        // This helper function should exist in your current app.js
        if (typeof populateFilter === "function") {
            populateFilter(data);
        }

    } catch (e) {
        console.error("Load Error:", e);
        container.innerHTML = `<p style="color:red; text-align:center;">Error loading data: ${e.message}</p>`;
    }
}

// 3. Updated renderPublic function with Merging Logic
function renderPublic(data) {
    const container = document.getElementById('publicGrid');
    const filterEl = document.getElementById('gurudwaraFilter');
    const filter = filterEl ? filterEl.value.toLowerCase() : 'all';
    
    // Check the state of our new checkbox
    const mergeCheckbox = document.getElementById('mergeWords');
    const isMergeEnabled = mergeCheckbox ? mergeCheckbox.checked : false;

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No Vaak found for this date.</p>';
        return;
    }

    container.innerHTML = '';
    const filtered = (filter === 'all') ? data : data.filter(i => i.gurudwaraName.toLowerCase() === filter);

// Inside your renderPublic function, find the displayVerse logic:

filtered.forEach(item => {
    let displayVerse = "";
    let mergeClass = ""; // Variable to hold the extra CSS class

    if (isMergeEnabled) {
        // 1. Wrap words in spans
        displayVerse = item.verse.split(/\s+/).map(word => `<span>${word}</span>`).join('');
        // 2. Add the 'merged' class to tighten spacing
        mergeClass = "merged";
    } else {
        displayVerse = item.verse;
        mergeClass = "";
    }

    container.innerHTML += `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="tag">${item.gurudwaraName}</span>
                <span class="meta">${item.gurudwaraLocation || ''}</span>
            </div>
            <p class="gurmukhi ${mergeClass}">${displayVerse}</p>
            <div class="meta" style="border-top:1px solid #eee; padding-top:10px; margin-top:15px;">
                <strong>Ang:</strong> ${item.pageNumber} <br>
                <small>Sevadar: ${item.editorName}</small>
            </div>
        </div>`;
});
}

function populateFilter(data) {
    const select = document.getElementById('gurudwaraFilter');
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
    const res = await fetch('/.auth/me');
    const auth = await res.json();
    const user = auth.clientPrincipal;

    if (!user) {
        window.location.href = "/.auth/login/aad";
        return;
    }

    document.getElementById('userDisplay').innerText = `User: ${user.userDetails}`;
    if (user.userRoles.includes('super_admin')) {
        document.querySelectorAll('.super-admin-only').forEach(el => el.classList.remove('hidden'));
    }
    loadRecentActivity(); // Initial load of activity
}

async function loadRecentActivity() {
    const body = document.getElementById('recentActivityBody');
    if (!body) return; // Exit if the table element isn't on the current page

    body.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Loading activity...</td></tr>';

    try {
        // Fetches from your backend API route
        const res = await fetch('/api/GetRecentActivity');
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const data = await res.json();
        
        if (data.length === 0) {
            body.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:10px;">No recent activity found.</td></tr>';
            return;
        }

        // Maps data to table rows
        body.innerHTML = data.map(item => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.date}</td>
                <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.gurudwaraName}</td>
                <td class="gurmukhi" style="padding: 12px; border-bottom: 1px solid #ddd; font-size: 1.1rem; text-align: left;">
                    ${item.verse.substring(0, 50)}...
                </td>
            </tr>`).join('');
            
    } catch (e) {
        console.error("Activity Load Error:", e);
        body.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red; padding:10px;">Error loading activity.</td></tr>';
    }
}

async function searchLibrary() {
    const kw = document.getElementById('libSearch').value;
    const resultsContainer = document.getElementById('libResults');
    if (kw.length < 1) return;

    try {
        const res = await fetch(`/api/LibraryManager?keyword=${encodeURIComponent(kw)}`);
        const data = await res.json();
        resultsContainer.innerHTML = data.length === 0 ? '<p>No results.</p>' : 
            data.map(item => `
                <div class="card" style="margin-bottom: 15px; border-left: 5px solid #2c3e50;">
                    <strong>Page: ${item.pageNumber}</strong>
                    <p class="gurmukhi">${item.verse}</p>
                    <button class="btn-success" onclick='publishVaak(event, ${JSON.stringify(item).replace(/'/g, "&#39;")})'>Publish</button>
                </div>`).join('');
    } catch (e) { resultsContainer.innerHTML = 'Error searching.'; }
}

async function publishVaak(event, item) {
    const btn = event.target;
    const date = document.getElementById('publishDate').value;
    if (!date || !confirm(`Publish for ${date}?`)) return;

    btn.innerText = "Publishing...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/EditorPublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verseItem: item, date: date })
        });
        const msg = await res.text();
        alert(res.ok ? "✅ " + msg : "❌ " + msg);
        if(res.ok) loadRecentActivity();
    } catch (e) { alert("Error: " + e.message); }
    finally { btn.innerText = "Publish"; btn.disabled = false; }
}

async function saveEditor() {
    // 1. Get references
    const elEmail = document.getElementById('editEmail');
    const elFn = document.getElementById('editFirstName');
    const elLn = document.getElementById('editLastName');
    const elGn = document.getElementById('editGurudwara');
    const elLoc = document.getElementById('editLocation');

    // 2. Validate elements exist to stop the "Null" error
    if (!elEmail || !elFn) {
        console.error("Form elements missing from HTML");
        alert("System Error: HTML IDs do not match JavaScript.");
        return;
    }

    const editorData = {
        firstName: elFn.value.trim(),
        lastName: elLn.value.trim(),
        email: elEmail.value.trim().toLowerCase(),
        gurudwaraName: elGn.value.trim(),
        gurudwaraLocation: elLoc.value.trim(),
        status: 'Active'
    };

    if (!editorData.email) {
        alert("Email is required.");
        return;
    }

    try {
        // Use exactly 'AdminEditors' as seen in your Azure Portal
        const res = await fetch('/api/ManageEditors', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editorData)
        });

        if (res.status === 404) {
            throw new Error("API Route not found on server. Check case sensitivity.");
        }

        if (res.ok) {
            alert("✅ Editor profile saved successfully!");
        } else {
            const errText = await res.text();
            alert("❌ Server Error: " + errText);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
        alert("❌ Network Error: " + e.message);
    }
}

async function loadEditorsList() {
    const tableBody = document.getElementById('editorsTableBody');
    if (!tableBody) return;

    try {
        // Fetch from your ManageEditors API (GET method)
        const res = await fetch('/api/ManageEditors');
        if (!res.ok) throw new Error("Could not fetch editors");

        const data = await res.json();
        
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">No editors registered yet.</td></tr>';
            return;
        }

        tableBody.innerHTML = data.map(editor => `
            <tr>
                <td style="padding: 10px; border: 1px solid #eee;">${editor.firstName} ${editor.lastName}</td>
                <td style="padding: 10px; border: 1px solid #eee;">${editor.email}</td>
                <td style="padding: 10px; border: 1px solid #eee;">${editor.gurudwaraName}</td>
                <td style="padding: 10px; border: 1px solid #eee;">${editor.gurudwaraLocation || 'N/A'}</td>
            </tr>`).join('');
    } catch (e) {
        console.error("Editor Load Error:", e);
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red; padding:10px;">Error loading editors list.</td></tr>';
    }
}

async function bulkImport() {
    try {
        const json = JSON.parse(document.getElementById('bulkJson').value);
        const res = await fetch('/api/LibraryManager', { // Points to working Library API
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json)
        });
        alert(await res.text());
        loadLibraryTable();
    } catch (e) { alert("Invalid JSON"); }
}

async function loadLibraryTable(searchQuery = '') {
    const body = document.getElementById('libraryTableBody');
    if (!body) return;

    body.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

    try {
        const res = await fetch(`/api/LibraryManager?search=${searchQuery}`);
        const data = await res.json();

        if (data.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center;">No records found.</td></tr>';
            return;
        }

        // Apply headers with specific classes for alignment
        const tableContainer = body.closest('table');
        tableContainer.classList.add('library-table');
        
        // Update header row (find the thead in your HTML and ensure it matches this)
        const thead = tableContainer.querySelector('thead');
        thead.innerHTML = `
            <tr>
                <th class="col-ang">Ang</th>
                <th class="col-verse">Verse</th>
                <th class="col-keywords">Keywords</th>
                <th class="col-actions">Actions</th>
            </tr>`;

        body.innerHTML = data.map(item => `
            <tr>
                <td class="col-ang">${item.pageNumber}</td>
                <td class="col-verse">
                    <div class="gurmukhi verse-preview" onclick="this.classList.toggle('expanded')" title="Click to expand/collapse">
                        ${item.verse}
                    </div>
                </td>
                <td class="col-keywords" style="font-size: 0.85rem; color: #666;">${item.keywords || ''}</td>
                <td class="col-actions">
                    <button class="btn-success btn-sm" onclick="preparePublish('${item.id}')">Select</button>
                    <button class="btn-danger btn-sm" onclick="deleteLibraryItem('${item.id}')">Delete</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading library.</td></tr>';
    }
}

async function deleteLibraryItem(id, pageNumber) {
    if (!confirm("Delete this verse?")) return;
    try {
        const res = await fetch(`/api/LibraryManager?id=${id}&page=${pageNumber}`, { method: 'DELETE' });
        if (res.ok) loadLibraryTable();
    } catch (e) { alert("Error deleting."); }
}

async function addSingleLibraryItem() {
    const page = document.getElementById('addLibPage').value.trim();
    const verse = document.getElementById('addLibVerse').value.trim();
    const keywords = document.getElementById('addLibKeywords').value.trim();

    // Validation
    if (!page || !verse) {
        alert("Please provide at least a Page Number and the Verse.");
        return;
    }

    // Creating the array format your POST API expects
    const payload = [{
        pageNumber: page,
        verse: verse,
        keywords: keywords
    }];

    // UI Feedback
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/LibraryManager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });

        if (res.ok) {
            alert("✅ Successfully added to library!");
            
            // Clear inputs
            document.getElementById('addLibPage').value = '';
            document.getElementById('addLibVerse').value = '';
            document.getElementById('addLibKeywords').value = '';
            
            // Refresh the table below
            loadLibraryTable();
        } else {
            const msg = await res.text();
            alert("❌ Error: " + msg);
        }
    } catch (e) {
        alert("Network Error: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function openTab(tabId) {
    // 1. Hide all tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 2. Remove 'active' class from all buttons in the tabs container
    document.querySelectorAll('.tabs button').forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. Show the target tab
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // 4. Highlight the button that was clicked
    // We search for the button that has the onclick function for this tabId
    const buttons = document.querySelectorAll('.tabs button');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });

    // 5. Trigger data loading based on tab
    if (tabId === 'libraryTab') loadLibraryTable();
    if (tabId === 'publishTab') loadRecentActivity();
    if (tabId === 'editorsTab') loadEditorsList();
}

window.loadLibraryTable = loadLibraryTable;
window.deleteLibraryItem = deleteLibraryItem;
window.searchLibrary = searchLibrary;
window.publishVaak = publishVaak;
window.saveEditor = saveEditor;
window.bulkImport = bulkImport;
window.openTab = openTab;
window.loadPublic = loadPublic;
