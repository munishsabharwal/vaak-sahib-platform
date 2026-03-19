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

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No Vaak found for this date.</p>';
        return;
    }

    const filtered = (filter === 'all') ? data : data.filter(i => i.gurudwaraName.toLowerCase() === filter);
    container.classList.toggle('single-card-layout', filtered.length === 1);

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; width: 100%;">No matches found.</p>';
        return;
    }

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

/* --- ADMIN & AUTH LOGIC --- */
async function initAdmin() {
    const res = await fetch('/.auth/me');
    const auth = await res.json();
    const user = auth.clientPrincipal;

    if (!user) {
        window.location.href = "/.auth/login/aad";
        return;
    }

    document.getElementById('userDisplay').innerText = `User: ${user.userDetails}`;
    const isSuperAdmin = user.userRoles.includes('super_admin');

    // Toggle visibility of admin elements
    document.querySelectorAll('.super-admin-only').forEach(el => {
        if (isSuperAdmin) {
            el.classList.remove('hidden');
            el.style.display = ''; 
        } else {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });

    loadGurudwaras(); // Essential for both dropdown and management
    loadRecentActivity();
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    const activeBtn = Array.from(document.querySelectorAll('.tabs button')).find(b => b.getAttribute('onclick')?.includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'libraryTab') loadLibraryTable();
    if (tabId === 'publishTab') loadRecentActivity();
    if (tabId === 'editorsTab') loadEditorsList();
    if (tabId === 'gurudwaraTab') loadGurudwaras();
}

/* --- GURUDWARA MASTER LIST LOGIC --- */
async function loadGurudwaras() {
    try {
        const response = await fetch('/api/ManageGurudwaras');
        const data = await response.json();

        // 1. Populate Management Table
        const tbody = document.getElementById('gurudwaraTableBody');
        if (tbody) {
            tbody.innerHTML = data.map(g => `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <td style="padding: 12px;">${g.name}</td>
                    <td style="padding: 12px;">${g.city}</td>
                    <td style="padding: 12px; text-align: right;">
                        <button onclick="deleteGurudwara('${g.id}')" style="background:none; border:none; color:#dc3545; cursor:pointer; font-weight:bold;">Delete</button>
                    </td>
                </tr>`).join('');
        }

        // 2. Populate Publish Dropdown
        const select = document.getElementById('gurudwaraSelect');
        if (select) {
            select.innerHTML = '<option value="">-- Select Gurudwara --</option>' + 
                data.map(g => `<option value="${g.name}" data-city="${g.city}">${g.name} (${g.city})</option>`).join('');
        }
    } catch (err) { console.error("Load Error:", err); }
}

async function addGurudwara() {
    const name = document.getElementById('newGName').value;
    const city = document.getElementById('newGCity').value;
    if (!name || !city) return alert("Enter both Name and City");

    try {
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
    } catch (err) { alert("Add failed."); }
}

async function deleteGurudwara(id) {
    if (!confirm("Delete this Gurudwara?")) return;
    const res = await fetch(`/api/ManageGurudwaras?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadGurudwaras();
}

/* --- PUBLISHING LOGIC --- */
async function publishVaak(event, item) {
    const btn = event.target;
    const date = document.getElementById('publishDate').value;
    const select = document.getElementById('gurudwaraSelect');
    
    if (!select || select.value === "") return alert("❌ Please select a Gurudwara.");
    const selectedOption = select.options[select.selectedIndex];
    
    item.gurudwaraName = selectedOption.value;
    item.gurudwaraLocation = selectedOption.getAttribute('data-city'); 

    if (!date || !confirm(`Publish for ${item.gurudwaraName} on ${date}?`)) return;

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

/* --- UTILITIES --- */
async function copyVaak(gurudwara, location, verse, ang) {
    const text = `*Daily Vaak Sahib*\n\n${verse}\n\n*Gurudwara:* ${gurudwara} (${location})\n*Ang:* ${ang}\n\nShared via: ${window.location.href}`;
    try {
        await navigator.clipboard.writeText(text);
        alert("✅ Copied to clipboard!");
    } catch (err) { console.error(err); }
}

// Global scope mapping for onclick attributes
window.initAdmin = initAdmin;
window.openTab = openTab;
window.loadPublic = loadPublic;
window.addGurudwara = addGurudwara;
window.deleteGurudwara = deleteGurudwara;
