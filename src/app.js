/* --- GLOBAL STATE --- */
let lastFetchedData = [];
let libraryCurrentPage = 1;
const libraryPageSize = 10;
let libraryAllData = [];

/* --- PUBLIC SITE LOGIC --- */
async function loadPublic() {
    const dateInput = document.getElementById('publicDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const container = document.getElementById('publicGrid');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading daily Vaaks...</div>';
    try {
        const res = await fetch(`/api/GetDailyVaak?date=${date}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        lastFetchedData = data; 
        renderPublic(data);
        if (typeof populateFilter === "function") populateFilter(data);
    } catch (e) {
        container.innerHTML = `<p style="color:red; text-align:center;">Error: ${e.message}</p>`;
    }
}

function renderPublic(data) {
    const container = document.getElementById('publicGrid');
    const filterEl = document.getElementById('gurudwaraFilter');
    const filter = filterEl ? filterEl.value.toLowerCase() : 'all';
    const isMergeEnabled = document.getElementById('mergeWords')?.checked || false;

    const filtered = (filter === 'all') ? data : data.filter(i => i.gurudwaraName.toLowerCase() === filter);
    if (!filtered || filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; width: 100%;">No matches found for this date.</p>';
        return;
    }

    container.classList.toggle('single-card-layout', filtered.length === 1);
    container.innerHTML = filtered.map(item => {
        let displayVerse = isMergeEnabled ? item.verse.split(/\s+/).map(w => `<span>${w}</span>`).join('') : item.verse;
        let shareVerse = isMergeEnabled ? item.verse.replace(/\s+/g, '') : item.verse;
        return `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                        <span class="tag">${item.gurudwaraName}</span>
                        <div class="meta" style="margin-top:5px; font-style:italic;">${item.gurudwaraLocation || ''}</div>
                    </div>
                    <button class="btn-share" onclick="copyVaak('${item.gurudwaraName}', '${item.gurudwaraLocation || ''}', '${shareVerse.replace(/'/g, "\\'")}', '${item.pageNumber}')">Share</button>
                </div>
                <p class="gurmukhi ${isMergeEnabled ? "merged" : ""}">${displayVerse}</p>
                <div class="meta" style="border-top:1px solid #eee; padding-top:10px; margin-top:15px;"><strong>Ang:</strong> ${item.pageNumber}</div>
            </div>`;
    }).join('');
}

function populateFilter(data) {
    const select = document.getElementById('gurudwaraFilter');
    if (!select) return;
    select.innerHTML = '<option value="all">All Gurudwaras</option>'; 
    const uniques = [...new Set(data.map(i => i.gurudwaraName))];
    uniques.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.toLowerCase();
        opt.innerText = g;
        select.appendChild(opt);
    });
}

/* --- ADMIN & AUTH LOGIC --- */
async function initAdmin() {
    try {
        const res = await fetch('/.auth/me');
        const auth = await res.json();
        const user = auth.clientPrincipal;

        if (!user) {
            window.location.href = "/.auth/login/aad";
            return;
        }

        document.getElementById('userDisplay').innerText = `User: ${user.userDetails}`;
        const isSuperAdmin = user.userRoles.includes('super_admin');

        document.querySelectorAll('.super-admin-only').forEach(el => {
            el.style.display = isSuperAdmin ? '' : 'none';
            isSuperAdmin ? el.classList.remove('hidden') : el.classList.add('hidden');
        });

        loadGurudwaras();
        loadRecentActivity();
    } catch (e) { console.error("Auth Init Error:", e); }
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    const activeBtn = Array.from(document.querySelectorAll('.tabs button')).find(b => b.getAttribute('onclick')?.includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'publishTab') loadRecentActivity();
    if (tabId === 'gurudwaraTab') loadGurudwaras();
    if (tabId === 'editorsTab') loadEditorsList();
    if (tabId === 'libraryTab') loadLibraryTable();
}

/* --- DATA FETCHING (ADMIN) --- */
async function loadRecentActivity() {
    const body = document.getElementById('recentActivityBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';
    try {
        const res = await fetch('/api/GetRecentActivity');
        const data = await res.json();
        body.innerHTML = data.length === 0 ? '<tr><td colspan="3">No activity found.</td></tr>' : 
            data.map(item => `
                <tr>
                    <td>${item.date}</td>
                    <td>${item.gurudwaraName}</td>
                    <td class="gurmukhi">${item.verse.substring(0, 50)}...</td>
                </tr>`).join('');
    } catch (e) { body.innerHTML = '<tr><td colspan="3">Error loading activity.</td></tr>'; }
}

function searchLibrary() {
    const searchInput = document.getElementById('libSearch');
    const kw = searchInput ? searchInput.value.trim() : '';
    loadLibraryTable(kw);
}

async function loadLibraryTable(searchQuery = '') {
    const body = document.getElementById('libraryTableBody');
    if (!body) return;
    
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;">${searchQuery ? 'Searching...' : 'Loading Library...'}</td></tr>`;
    
    try {
        // Use 'keyword' to match the API expectation
        const res = await fetch(`/api/LibraryManager?keyword=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) throw new Error("Fetch failed");
        
        libraryAllData = await res.json();
        
        // Sort by Ang (Page Number)
        libraryAllData.sort((a, b) => parseInt(a.pageNumber || 0) - parseInt(b.pageNumber || 0));
        
        renderLibraryPage(1); 
    } catch (e) { 
        console.error("Library Load Error:", e);
        body.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">${searchQuery ? 'No results found.' : 'Error loading library.'}</td></tr>`; 
    }
}

async function loadEditorsList() {
    const tableBody = document.getElementById('editorsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
    try {
        const res = await fetch('/api/ManageEditors');
        const data = await res.json();
        tableBody.innerHTML = data.length === 0 ? '<tr><td colspan="4">No editors found.</td></tr>' : 
            data.map(e => `
                <tr>
                    <td>${e.firstName} ${e.lastName}</td>
                    <td>${e.email}</td>
                    <td>${e.gurudwaraName}</td>
                    <td>${e.gurudwaraLocation || 'N/A'}</td>
                </tr>`).join('');
    } catch (e) { tableBody.innerHTML = '<tr><td colspan="4">Error loading editors.</td></tr>'; }
}

function renderLibraryPage(page) {
    libraryCurrentPage = page;
    const body = document.getElementById('libraryTableBody');
    const start = (page - 1) * libraryPageSize;
    const pageData = libraryAllData.slice(start, start + libraryPageSize);
    
    body.innerHTML = pageData.map(item => `
        <tr>
            <td class="col-ang">${item.pageNumber}</td>
            <td class="col-verse"><div class="gurmukhi">${item.verse}</div></td>
            <td class="col-keywords">${item.keywords || ''}</td>
            <td class="col-actions">
                <button class="btn-danger btn-sm" onclick="deleteLibraryItem('${item.id}', '${item.pageNumber}')">Delete</button>
            </td>
        </tr>`).join('');
    
    const nav = document.getElementById('libraryPagination');
    const total = Math.ceil(libraryAllData.length / libraryPageSize);
    if (nav) nav.innerHTML = `<button onclick="renderLibraryPage(${page-1})" ${page===1?'disabled':''}>Prev</button> <span>Page ${page} of ${total}</span> <button onclick="renderLibraryPage(${page+1})" ${page>=total?'disabled':''}>Next</button>`;
}

/* --- GURUDWARA LOGIC --- */
async function loadGurudwaras() {
    try {
        const response = await fetch('/api/ManageGurudwaras');
        const data = await response.json();
        const tbody = document.getElementById('gurudwaraTableBody');
        if (tbody) {
            tbody.innerHTML = data.map(g => `
                <tr>
                    <td style="padding: 12px;">${g.name}</td>
                    <td style="padding: 12px;">${g.city}</td>
                    <td style="padding: 12px; text-align: right;">
                        <button onclick="deleteGurudwara('${g.id}')" style="color:#dc3545; border:none; background:none; cursor:pointer;">Delete</button>
                    </td>
                </tr>`).join('');
        }
        const select = document.getElementById('gurudwaraSelect');
        if (select) {
            select.innerHTML = '<option value="">-- Select Gurudwara --</option>' + 
                data.map(g => `<option value="${g.name}" data-city="${g.city}">${g.name} (${g.city})</option>`).join('');
        }
    } catch (err) { console.error("Gurudwara Load Error:", err); }
}

async function addGurudwara() {
    const name = document.getElementById('newGName').value;
    const city = document.getElementById('newGCity').value;
    if (!name || !city) return alert("Enter both Name and City");
    const res = await fetch('/api/ManageGurudwaras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city })
    });
    if (res.ok) {
        document.getElementById('newGName').value = '';
        document.getElementById('newGCity').value = '';
        loadGurudwaras();
    }
}

async function deleteGurudwara(id) {
    if (!confirm("Delete this Gurudwara?")) return;
    const res = await fetch(`/api/ManageGurudwaras?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadGurudwaras();
}

/* --- ACTIONS & UTILS --- */
async function publishVaak(event, item) {
    const btn = event.target;
    const date = document.getElementById('publishDate').value;
    const select = document.getElementById('gurudwaraSelect');
    if (!select || select.value === "") return alert("Please select a Gurudwara.");
    const selected = select.options[select.selectedIndex];
    
    item.gurudwaraName = selected.value;
    item.gurudwaraLocation = selected.getAttribute('data-city'); 

    if (!date || !confirm(`Publish for ${item.gurudwaraName} on ${date}?`)) return;
    btn.disabled = true;
    try {
        const res = await fetch('/api/EditorPublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verseItem: item, date: date })
        });
        alert(res.ok ? "✅ Published!" : "❌ Error publishing.");
        if (res.ok) loadRecentActivity();
    } finally { btn.disabled = false; }
}

async function copyVaak(gurudwara, location, verse, ang) {
    const text = `*Daily Vaak Sahib*\n\n${verse}\n\n*Gurudwara:* ${gurudwara} (${location})\n*Ang:* ${ang}\n\nShared via: ${window.location.href}`;
    await navigator.clipboard.writeText(text);
    alert("✅ Copied to clipboard!");
}

async function deleteLibraryItem(id) {
    if (!confirm("Delete this verse?")) return;
    const res = await fetch(`/api/LibraryManager?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadLibraryTable();
}

/* --- BOOTSTRAP --- */
window.initAdmin = initAdmin;
window.openTab = openTab;
window.searchLibrary = searchLibrary;
window.loadLibraryTable = loadLibraryTable;
window.loadPublic = loadPublic;
window.addGurudwara = addGurudwara;
window.deleteGurudwara = deleteGurudwara;
window.publishVaak = publishVaak;
window.loadLibraryTable = loadLibraryTable;
window.renderLibraryPage = renderLibraryPage;
window.deleteLibraryItem = deleteLibraryItem;

document.addEventListener('DOMContentLoaded', () => {
    // Public Page Logic
    if (document.getElementById('publicGrid')) {
        loadPublic();
    }

    // Admin Page Logic
    const adminDisplay = document.getElementById('userDisplay');
    if (adminDisplay) {
        initAdmin();

        // Attach Enter Key listener to the search input
        const searchInput = document.getElementById('libSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); 
                    searchLibrary();
                }
            });
        }
    }
});
