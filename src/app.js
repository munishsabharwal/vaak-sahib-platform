/* --- PUBLIC SITE LOGIC --- */
async function loadPublic() {
    const dateInput = document.getElementById('publicDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    
    try {
        const res = await fetch(`/api/GetDailyVaak?date=${date}`);
        const data = await res.json();
        window.publicData = data; 
        renderPublic(data);
        populateFilter(data);
    } catch (e) { console.error("Error loading data", e); }
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
    if(kw.length < 2) return;

    const res = await fetch(`/api/AdminLibrary?keyword=${encodeURIComponent(kw)}`);
    const data = await res.json();
    
    document.getElementById('libResults').innerHTML = data.map(item => `
        <div class="card">
            <strong>Page: ${item.pageNumber}</strong>
            <p class="gurmukhi">${item.verse}</p>
            <p class="meta">Keywords: ${item.keywords}</p>
            <button class="btn-success" onclick='publishVaak(${JSON.stringify(item)})'>Publish This</button>
        </div>
    `).join('');
}

// EDITOR: Publish
async function publishVaak(item) {
    const date = document.getElementById('publishDate').value;
    const res = await fetch('/api/EditorPublish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verseItem: item, date: date })
    });
    
    if(res.ok) {
        alert("Published successfully!");
        searchLibrary(); // Refresh
    } else {
        alert("Error: " + await res.text());
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

function openTab(name) {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
    document.getElementById(name).classList.add('active');
}
