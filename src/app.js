/* --- PUBLIC SITE LOGIC --- */
async function loadPublic() {
    const dateInput = document.getElementById('publicDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const container = document.getElementById('publicGrid');
    
    container.innerHTML = '<p>Loading...</p>';

    try {
        const res = await fetch(`/api/GetDailyVaak?date=${date}`);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);

        const data = await res.json();
        renderPublic(data);
        populateFilter(data);

    } catch (e) {
        container.innerHTML = `<div style="color:red; padding:20px; border:1px solid red;"><strong>Error:</strong> ${e.message}</div>`;
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
                <div class="meta"><strong>Page:</strong> ${item.pageNumber} <br><small>Editor: ${item.editorName}</small></div>
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
    if (!body) return;

    try {
        const res = await fetch('/api/GetRecentActivity');
        const data = await res.json();
        body.innerHTML = data.length === 0 ? '<tr><td colspan="3">No recent activity.</td></tr>' : 
            data.map(item => `
                <tr>
                    <td>${item.date}</td>
                    <td>${item.gurudwaraName}</td>
                    <td class="gurmukhi">${item.verse.substring(0, 40)}...</td>
                </tr>`).join('');
    } catch (e) {
        body.innerHTML = '<tr><td colspan="3">Error loading activity.</td></tr>';
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
        const res = await fetch('/api/AdminEditors', { 
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

async function loadLibraryTable() {
    const tableBody = document.getElementById('libraryTableBody');
    const searchVal = document.getElementById('libAdminSearch').value.trim();
    const url = searchVal ? `/api/LibraryManager?keyword=${encodeURIComponent(searchVal)}` : `/api/LibraryManager`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        tableBody.innerHTML = data.map(item => `
            <tr>
                <td>${item.pageNumber}</td>
                <td class="gurmukhi">${item.verse}</td>
                <td>${item.keywords}</td>
                <td><button class="btn-danger" onclick="deleteLibraryItem('${item.id}', '${item.pageNumber}')">Delete</button></td>
            </tr>`).join('');
    } catch (e) { tableBody.innerHTML = 'Error loading table.'; }
}

async function deleteLibraryItem(id, pageNumber) {
    if (!confirm("Delete this verse?")) return;
    try {
        const res = await fetch(`/api/LibraryManager?id=${id}&page=${pageNumber}`, { method: 'DELETE' });
        if (res.ok) loadLibraryTable();
    } catch (e) { alert("Error deleting."); }
}

function openTab(name) {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
    const target = document.getElementById(name);
    if(target) target.classList.add('active');
    if(name === 'libraryTab') loadLibraryTable();
    if(name === 'publishTab') loadRecentActivity();
}

window.loadLibraryTable = loadLibraryTable;
window.deleteLibraryItem = deleteLibraryItem;
window.searchLibrary = searchLibrary;
window.publishVaak = publishVaak;
window.saveEditor = saveEditor;
window.bulkImport = bulkImport;
window.openTab = openTab;
window.loadPublic = loadPublic;
