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
        window.currentUserIsAdmin = isSuperAdmin;

        // Strictly manage visibility
        document.querySelectorAll('.super-admin-only').forEach(el => {
            if (isSuperAdmin) {
                el.classList.remove('hidden');
                el.style.display = ''; 
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });

        if (isSuperAdmin) {
            loadGurudwaras(); // Full access
        } else {
            // EDITOR: Fetch profile from ManageEditors using email
            const profileRes = await fetch(`/api/ManageEditors?email=${encodeURIComponent(user.userDetails)}`);
            if (profileRes.ok) {
                window.editorProfile = await profileRes.json();
            }
        }
        
        loadRecentActivity();
    } catch (e) { console.error("Init Error:", e); }
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

let searchDebounceTimer;

async function loadLibraryTable(searchQuery = '') {
    const gridContainer = document.getElementById('libResults'); // For "Publish" tab
    const tableBody = document.getElementById('libraryTableBody'); // For "Manage Library" tab
    
    try {
        // MATCHING THE BACKEND: Changed 'search=' to 'keyword='
        const url = searchQuery.trim() 
            ? `/api/LibraryManager?keyword=${encodeURIComponent(searchQuery.trim())}` 
            : '/api/LibraryManager';
            
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        
        const data = await res.json();
        
        // Update global variable for pagination
        libraryAllData = data;

        // Render to the Grid (Publish Tab)
        if (gridContainer) {
            renderLibraryGrid(data); 
        }
        
        // Render to the Table (Manage Tab)
        if (tableBody) {
            renderLibraryPage(1); 
        }

    } catch (e) {
        console.error("Library Search Error:", e);
    }
}
// 2. The "As You Type" trigger for Step 2 (Publishing)
function searchLibrary() {
    const kw = document.getElementById('libSearch').value;
    loadLibraryTable(kw);
}

// 3. The Grid Renderer for Step 2 (Matches your HTML IDs)
function renderLibraryGrid(data) {
    const container = document.getElementById('libResults');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">No results.</div>';
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="tag">Ang: ${item.pageNumber}</span>
                <button class="btn-primary btn-sm" onclick="publishVaak(event, ${JSON.stringify(item).replace(/"/g, '&quot;')})">Publish</button>
            </div>
            <p class="gurmukhi">${item.verse}</p>
            <div style="font-size:0.8rem; color:#666; margin-top:5px;">${item.keywords || ''}</div>
        </div>
    `).join('');
}

// 4. Helper to connect the "Publish" button to the actual API call
function triggerPublish(event, itemId) {
    const itemToPublish = libraryAllData.find(i => i.id === itemId);
    if (itemToPublish) {
        publishVaak(event, itemToPublish);
    } else {
        alert("Error: Verse data not found.");
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
async function publishVaak(event, libraryItem) {
    const btn = event.target;
    const dateInput = document.getElementById('publishDate');
    // For editors, the date input is hidden, so default to today if not found
    const date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
    
    let payload = {
        date: date,
        verse: libraryItem.verse,
        pageNumber: libraryItem.pageNumber
    };

    if (window.currentUserIsAdmin) {
        const sel = document.getElementById('gurudwaraSelect');
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.value) return alert("Please select a Gurudwara first!");
        
        payload.gurudwaraName = opt.text;
        payload.location = opt.getAttribute('data-location');
    } else {
        if (!window.editorProfile) return alert("Editor profile not loaded. Please refresh.");
        
        payload.gurudwaraName = window.editorProfile.gurudwaraName;
        payload.location = window.editorProfile.location;
    }

    if (!confirm(`Publish to ${payload.gurudwaraName} for ${date}?`)) return;

    btn.disabled = true;
    try {
        // Corrected API endpoint
        const res = await fetch('/api/EditorPublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            alert("✅ Published Successfully!");
            loadRecentActivity();
        } else {
            const err = await res.text();
            alert("Error: " + err);
        }
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
    }
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
window.triggerPublish = triggerPublish;
window.publishVaak = publishVaak;
window.loadLibraryTable = loadLibraryTable;
window.renderLibraryPage = renderLibraryPage;
window.deleteLibraryItem = deleteLibraryItem;

/* --- 3. THE REPAIRED BOOTSTRAP (Bottom of file) --- */
document.addEventListener('DOMContentLoaded', () => {
    // Public Page
    if (document.getElementById('publicGrid')) {
        loadPublic();
    }

    // Admin Page
    if (document.getElementById('userDisplay')) {
        initAdmin();
        // We don't need a manual listener here because 
        // the HTML has onkeyup="searchLibrary()"
    }
});
