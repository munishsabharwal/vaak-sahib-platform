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
    
    // 1. Read the selection. 'const' is fine here because we won't reassign it.
    const filterValue = filterEl ? filterEl.value.toLowerCase() : 'all';
    const isMergeEnabled = document.getElementById('mergeWords')?.checked || false;

    // 2. Logic: If 'all', use 'data'. If specific, filter 'data'.
    const filtered = (filterValue === 'all') 
        ? data 
        : data.filter(i => i.gurudwaraName.toLowerCase() === filterValue);
    
    if (!filtered || filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; width: 100%;">No matches found.</p>';
        return;
    }
    
    // FALLBACK: If Harmandir Sahib isn't found for that date, show all as a backup
    const finalDisplay = (filtered.length === 0) ? data : filtered;

    if (!finalDisplay || finalDisplay.length === 0) {
        container.innerHTML = '<p style="text-align: center; width: 100%;">No matches found for this date.</p>';
        return;
    }
    
    container.classList.toggle('single-card-layout', filtered.length === 1);
    container.innerHTML = filtered.map(item => {
        let displayVerse = item.verse;
        if (isMergeEnabled) {
            displayVerse = item.verse.split(/\s+/).map(w => {
                return `<span>${w}</span>`;
            }).join('');
        }

        let shareVerse = isMergeEnabled ? item.verse.replace(/\s+/g, '') : item.verse;
        
        return `
            <div class="card transparent-card"> <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                        <span class="tag">${item.gurudwaraName}</span>
                        <div class="meta" style="margin-top:5px; font-style:italic;">${item.gurudwaraLocation || ''}</div>
                    </div>
                    <button class="btn-share" onclick="copyVaak('${item.gurudwaraName}', '${item.gurudwaraLocation || ''}', '${shareVerse.replace(/'/g, "\\'")}', '${item.pageNumber}', '${item.date}')">Share</button>                </div>
                <p class="gurmukhi ${isMergeEnabled ? "merged" : ""}">${displayVerse}</p>
                <div class="meta" style="border-top:1px solid rgba(0,0,0,0.1); padding-top:10px; margin-top:15px;"><strong>Ang:</strong> ${item.pageNumber}</div>
            </div>`;
    }).join('');
}

function populateFilter(data) {
    const select = document.getElementById('gurudwaraFilter');
    if (!select) return;
    
    // Save the current selection before clearing
    const currentSelection = select.value;
    
    select.innerHTML = '<option value="all">All Gurdwaras</option>'; 
    const uniques = [...new Set(data.map(i => i.gurudwaraName))];
    
    uniques.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; // Keep original casing for the value
        opt.innerText = g;
        if (g === currentSelection) opt.selected = true; // Keep it selected
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

        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) {
            userDisplay.innerText = `User: ${user.userDetails}`;
            }
        
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

// Inside initAdmin() in app.js
if (isSuperAdmin) {
    loadGurudwaras(); 
} else {
    // Fetch editor profile
    const profileRes = await fetch(`/api/ManageEditors?email=${encodeURIComponent(user.userDetails)}`);
    if (profileRes.ok) {
        const data = await profileRes.json();
        // Check if data is an array and take the first item, otherwise take data
        window.editorProfile = Array.isArray(data) ? data[0] : data;
        
        console.log("Loaded Editor Profile:", window.editorProfile); // Debugging
    } else {
        console.error("Failed to fetch Editor profile");
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

    if (tabId === 'gurudwaraTab') loadGurudwaras();
    if (tabId === 'editorsTab') {
        loadGurudwaras(); // First, ensure the dropdowns have the latest Gurudwaras
        loadEditorsList(); // Then, load the list of people
    }
    // 1. If switching to Publish Tab
    if (tabId === 'publishTab') {
        // Keep your recent activity loader
        loadRecentActivity(); 

        // ALSO: Clear the search results so it doesn't show the whole library
        const gridContainer = document.getElementById('libResults');
        const searchBox = document.getElementById('libSearch');
        
        if (searchBox) searchBox.value = ''; 
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:30px; color:#666;">
                    <p> Search for a verse above to publish a new Vaak.</p>
                </div>`;
        }
    }

    // 2. If switching to Manage Library Tab
    if (tabId === 'libraryTab') {
        // Load the full list but with pagination (10 at a time)
        loadLibraryTable(''); 
    }
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
    const gridContainer = document.getElementById('libResults'); // Publish Tab
    const tableBody = document.getElementById('libraryTableBody'); // Manage Tab
    
    // 1. CLEAR previous results before starting a new search
    if (gridContainer) gridContainer.innerHTML = ''; 
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Searching...</td></tr>';
    
    try {
        const url = searchQuery.trim() 
            ? `/api/LibraryManager?keyword=${encodeURIComponent(searchQuery.trim())}` 
            : '/api/LibraryManager';
            
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        
        const data = await res.json();
        
        // Update global variable
        libraryAllData = data;

        // 2. Render to the Grid (Publish Tab)
        if (gridContainer) {
            renderLibraryGrid(data); 
        }
        
        // 3. Render to the Table (Manage Tab)
        if (tableBody) {
            renderLibraryPage(1); // This ensures only 10 show
        }

    } catch (e) {
        console.error("Library Search Error:", e);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="2">No results found.</td></tr>';
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

    // Only show the first 20 results in the 'Publish' grid to keep it fast
    const displayData = data.slice(0, 20);

    container.innerHTML = displayData.map(item => `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="tag">Ang: ${item.pageNumber}</span>
                <button class="btn-primary btn-sm" onclick="publishVaak(event, ${JSON.stringify(item).replace(/"/g, '&quot;')})">Publish</button>
            </div>
            <p class="gurmukhi">${item.verse}</p>
        </div>
    `).join('');
    
    if (data.length > 20) {
        container.innerHTML += `<div style="grid-column: 1/-1; text-align:center; color:#666; font-size:0.8rem;">Showing first 20 of ${data.length} results. Please refine your search for more.</div>`;
    }
}

// 4. Helper to connect the "Publish" button to the actual API call
async function triggerPublish() {
    const date = document.getElementById('publishDate').value;
    const gurudwara = document.getElementById('gurudwaraSelect').value;
    const page = document.getElementById('pageNumber').value;
    const verse = document.getElementById('verseContent').value;
    const location = document.getElementById('gurudwaraLocation').value;
    
    if (!date || !gurudwara || !page || !verse) {
        alert("Please fill all fields and fetch a verse first.");
        return;
    }

    // LOOKUP: Check if this Gurudwara already has a record for this date
    const existing = lastFetchedData.find(item => 
        item.date === date && 
        item.gurudwaraName === gurudwara
    );

    const payload = {
        date: date,
        gurudwaraName: gurudwara,
        pageNumber: page,
        verse: verse,
        gurudwaraLocation: location
    };

    // If record exists, we include the ID to trigger a "Replace" (Upsert)
    if (existing && existing.id) {
        payload.id = existing.id;
        const confirmReplace = confirm(`A Vaak for ${gurudwara} already exists on this date. Would you like to replace it?`);
        if (!confirmReplace) return;
    }

    await publishVaak(payload);
}

/* --- Update this function to show the new columns & Action buttons --- */
async function loadEditorsList() {
    const tableBody = document.getElementById('editorsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
    try {
        const res = await fetch('/api/ManageEditors');
        const data = await res.json();
        tableBody.innerHTML = data.length === 0 ? '<tr><td colspan="6">No editors found.</td></tr>' : 
            data.map(e => `
                <tr>
                    <td>${e.firstName} ${e.lastName}</td>
                    <td>${e.email}</td>
                    <td>${e.gurudwaraName}</td>
                    <td><span class="tag" style="background: ${e.status === 'Active' ? '#dff6dd' : '#fde7e9'}; color: ${e.status === 'Active' ? '#107c10' : '#a80000'};">${e.status || 'Active'}</span></td>
                    <td>${e.comments || ''}</td>
                    <td style="text-align: right; min-width: 120px;">
                        <button onclick="prepareEditEditor('${e.email}', '${e.firstName.replace(/'/g, "\\'")}', '${e.lastName.replace(/'/g, "\\'")}', '${(e.gurudwaraName || '').replace(/'/g, "\\'")}', '${e.status || 'Active'}', '${(e.comments || '').replace(/'/g, "\\'")}')" style="color:#0078d4; border:none; background:none; cursor:pointer; margin-right:10px;">Edit</button>
                        <button onclick="deleteEditor('${e.email}')" style="color:#dc3545; border:none; background:none; cursor:pointer;">Delete</button>
                    </td>
                </tr>`).join('');
    } catch (e) { tableBody.innerHTML = '<tr><td colspan="6">Error loading editors.</td></tr>'; }
}

/* --- Add this brand new function to populate the form for Editing --- */
async function prepareEditEditor(email, firstName, lastName, gurudwaraName, status, comments) {
    // THE FIX: Ensure dropdown is populated right before we try to set its value
    const editorSelect = document.getElementById('editGurudwara'); // 🚨 FIXED ID HERE
    if (editorSelect && window.gurudwaraOptionsHtml) {
        editorSelect.innerHTML = window.gurudwaraOptionsHtml;
    }

    document.getElementById('editEmail').value = email;
    // Lock the email field so they don't accidentally change the ID
    document.getElementById('editEmail').readOnly = true; 
    document.getElementById('editEmail').style.background = '#eee';
    
    document.getElementById('editFirstName').value = firstName;
    document.getElementById('editLastName').value = lastName;
    document.getElementById('editGurudwara').value = gurudwaraName;
    updateEditorLocation(); 
    
    document.getElementById('editStatus').value = status;
    document.getElementById('editComments').value = comments;
    
    document.getElementById('editorFormTitle').innerText = "Edit Editor Profile";
    document.getElementById('editorsTab').scrollIntoView();
}

function renderLibraryPage(page) {
    libraryCurrentPage = page;
    const body = document.getElementById('libraryTableBody');
    if (!body) return;

    // This ensures only 'libraryPageSize' (10) items are shown at a time
    const start = (page - 1) * libraryPageSize;
    const pageData = libraryAllData.slice(start, start + libraryPageSize);
    
    body.innerHTML = pageData.map(item => `
        <tr>
            <td style="text-align: center; font-weight: bold; color: #555; vertical-align: top; padding: 12px;">
                ${item.pageNumber}
            </td>
            <td style="padding: 12px;">
                <div class="gurmukhi" style="font-size: 1.25rem; line-height: 1.7;">${item.verse}</div>
            </td>
        </tr>`).join('');
    
    // Pagination Controls
    const nav = document.getElementById('libraryPagination');
    const total = Math.ceil(libraryAllData.length / libraryPageSize);
    if (nav) {
        nav.innerHTML = `
            <div style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 15px;">
                <button class="btn-secondary" onclick="renderLibraryPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>Prev</button>
                <span style="font-size: 0.9rem;">Page <strong>${page}</strong> of ${total}</span>
                <button class="btn-secondary" onclick="renderLibraryPage(${page + 1})" ${page >= total ? 'disabled' : ''}>Next</button>
            </div>`;
    }
}

let editingGurudwaraId = null; 

async function loadGurudwaras() {
    try {
        const res = await fetch('/api/ManageGurudwaras');
        const data = await res.json();
        
        // Match the IDs exactly as they appear in your admin.html
        const pubSelect = document.getElementById('gurudwaraSelect'); 
        const editorSelect = document.getElementById('editGurudwara'); // Fixed ID

        let html = '<option value="">-- Select Gurdwara --</option>';
        data.forEach(item => {
            // Use 'city' for the location attribute
            const loc = item.city || ""; 
            html += `<option value="${item.name}" data-location="${loc}">${item.name}</option>`;
        });

        if (pubSelect) pubSelect.innerHTML = html;
        if (editorSelect) {
            editorSelect.innerHTML = html;
            console.log("Editor dropdown populated successfully");
        }

        // Update the management table (Step 1 view)
        const tbody = document.getElementById('gurudwaraTableBody');
        if (tbody) {
            tbody.innerHTML = data.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.city || ''}</td>
                    <td>
                        <button class="btn-secondary" onclick="prepareEditGurudwara('${item.id}')">Edit</button>
                        <button class="btn-danger" onclick="deleteGurudwara('${item.id}')">Delete</button>
                    </td>
                </tr>`).join('');
        }
    } catch (e) {
        console.error("Error loading Gurudwaras:", e);
    }
}

async function saveGurudwara() {
    const name = document.getElementById('newGName').value.trim();
    const city = document.getElementById('newGCity').value.trim();

    if (!name || !city) return alert("Please enter Name and City");

    const payload = { name, city };
    if (editingGurudwaraId) {
        payload.id = editingGurudwaraId;
    }

    try {
        const res = await fetch('/api/ManageGurudwaras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(editingGurudwaraId ? "✅ Updated!" : "✅ Added!");
            editingGurudwaraId = null;
            document.getElementById('newGName').value = '';
            document.getElementById('newGCity').value = '';
            loadGurudwaras();
        } else {
            alert("Error: " + await res.text());
        }
    } catch (e) { alert("Network Error: " + e.message); }
}

async function deleteGurudwara(id, name) {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
        // Only passing ID now because partition key is /id
        const res = await fetch(`/api/ManageGurudwaras?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadGurudwaras();
        } else {
            alert("Delete failed: " + await res.text());
        }
    } catch (e) { alert("Error: " + e.message); }
}
function prepareEditGurudwara(id, name, city) {
    editingGurudwaraId = id;
    document.getElementById('newGName').value = name;
    document.getElementById('newGCity').value = city;
    document.getElementById('gurudwaraTab').scrollIntoView();
}

function updateEditorLocation() {
    const sel = document.getElementById('editGurudwara'); // Fixed ID
    const locInput = document.getElementById('editLocation');
    if (sel && locInput) {
        const selectedOption = sel.options[sel.selectedIndex];
        locInput.value = selectedOption.getAttribute('data-location') || "";
    }
}

/* --- ACTIONS & UTILS --- */

async function publishVaak(event, libraryItem) {
    const btn = event.target;
    const dateInput = document.getElementById('publishDate');
    const date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
    
    let gName = "";
    let gLoc = "Unknown";

    if (window.currentUserIsAdmin) {
        const sel = document.getElementById('gurudwaraSelect');
        const opt = sel ? sel.options[sel.selectedIndex] : null;
        if (!opt || !opt.value) return alert("Please select a Gurudwara from Step 1 first!");
        
        gName = opt.value;
        // This grabs the 'city' we put in 'data-location' in the function above
        gLoc = opt.getAttribute('data-location') || "Unknown";
    } else {
        // For regular editors, use their assigned profile location
        const profile = window.editorProfile;
        if (!profile) return alert("Editor profile not loaded. Please refresh.");
        
        gName = profile.gurudwaraName;
        gLoc = profile.gurudwaraLocation || "Unknown";
    }

    // This popup will now show the City
    if (!confirm(`Publish to ${gName} (${gLoc}) for ${date}?`)) return;

    const finalBody = {
        date: date,
        verseItem: {
            verse: libraryItem.verse,
            pageNumber: libraryItem.pageNumber,
            gurudwaraName: gName,
            gurudwaraLocation: gLoc
        }
    };

    btn.disabled = true;
    try {
        const res = await fetch('/api/EditorPublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalBody)
        });
        if (res.ok) {
            alert("✅ Published successfully!");
            if (typeof loadRecentActivity === 'function') loadRecentActivity();
        } else {
            alert("Error: " + await res.text());
        }
    } catch (e) {
        alert("Network Error: " + e.message);
    } finally {
        btn.disabled = false;
    }
}

async function copyVaak(gurudwara, location, verse, ang, hDate) {
    // 1. Priority: Use the date from the Hukamnama itself (hDate)
    // 2. Fallback: Use the public date picker, then the admin date picker, then today.
    const rawDate = hDate || 
                    document.getElementById('publicDate')?.value || 
                    document.getElementById('publishDate')?.value || 
                    new Date().toISOString().split('T')[0];

    // Format the date to be readable (e.g., April 24, 2026)
    const dateParts = rawDate.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const dateDisplay = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    const cleanVerse = verse.trim();

    // Unicode icons
    const iconBook = "\u{1F4D6}";
    const iconPin  = "\u{1F4CD}";
    const iconCal  = "\u{1F4C5}";
    const iconNum  = "\u{1F522}";

    const text = `${iconBook} *Daily Hukamnama by www.Larivaarbani.org*\n` +
                 `${iconPin} *From:* ${gurudwara}, ${location}\n` +
                 `${iconCal} *Date:* ${dateDisplay}\n` +
                 `${iconNum} *Ang:* ${ang}\n\n` +
                 `${cleanVerse}`;

    try {
        await navigator.clipboard.writeText(text);
        alert("✅ Formatted Vaak copied to clipboard!");
    } catch (err) {
        console.error("Clipboard Error:", err);
        alert("❌ Failed to copy.");
    }
}

async function deleteLibraryItem(id) {
    if (!confirm("Delete this verse?")) return;
    const res = await fetch(`/api/LibraryManager?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadLibraryTable();
}

/* --- NAVIGATION LOGIC --- */
function showSection(sectionId) {
    // Hide all sections
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('about-section').classList.add('hidden');
    document.getElementById('contact-section').classList.add('hidden');

    // Show selected section
    document.getElementById(sectionId + '-section').classList.remove('hidden');
    
    // If going home, reload the data to ensure it's fresh
    if (sectionId === 'home') {
        loadPublic();
    }
}

/* --- Update the save logic to include Status, Comments, and reset the form --- */
async function saveEditor() {
    const emailField = document.getElementById('editEmail');
    const firstNameField = document.getElementById('editFirstName');
    const lastNameField = document.getElementById('editLastName');
    const gNameField = document.getElementById('editGurudwara');
    const gLocField = document.getElementById('editLocation');
    const statusField = document.getElementById('editStatus');
    const commentsField = document.getElementById('editComments');

    const email = emailField?.value?.trim();
    const firstName = firstNameField?.value?.trim();
    const lastName = lastNameField?.value?.trim();
    const gurudwaraName = gNameField?.value?.trim() || "";
    const gurudwaraLocation = gLocField?.value?.trim() || "";
    const status = statusField?.value || "Active";
    const comments = commentsField?.value?.trim() || "";

    if (!email || !firstName || !lastName) {
        return alert("Please fill out Email, First Name, and Last Name!");
    }

    const payload = {
        email, firstName, lastName, gurudwaraName, gurudwaraLocation, status, comments
    };

    try {
        const res = await fetch('/api/ManageEditors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Editor profile saved successfully!");
            // Reset the form back to 'New Editor' mode
            if(emailField) { emailField.value = ''; emailField.readOnly = false; emailField.style.background = '#fff'; }
            if(firstNameField) firstNameField.value = '';
            if(lastNameField) lastNameField.value = '';
            if(gNameField) gNameField.value = '';
            if(gLocField) gLocField.value = '';
            if(statusField) statusField.value = 'Active';
            if(commentsField) commentsField.value = '';
            document.getElementById('editorFormTitle').innerText = "Register New Editor";
            
            if (typeof loadEditorsList === "function") loadEditorsList();
        } else {
            alert("Server Error: " + await res.text());
        }
    } catch (e) {
        alert("Network Error: " + e.message);
    }
}

/* --- Add this brand new function to handle Deletion --- */
async function deleteEditor(email) {
    if (!confirm(`Are you sure you want to remove the editor: ${email}?`)) return;
    try {
        const res = await fetch(`/api/ManageEditors?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
        if (res.ok) {
            loadEditorsList();
        } else {
            alert("Delete failed: " + await res.text());
        }
    } catch (e) { alert("Error: " + e.message); }
}

async function addSingleLibraryItem(event) {
    const page = document.getElementById('addLibPage').value.trim();
    const verse = document.getElementById('addLibVerse').value.trim();
    const keywords = document.getElementById('addLibKeywords').value.trim();

    if (!page || !verse) {
        alert("Please provide at least a Page Number and the Verse.");
        return;
    }

    const payload = [{
        pageNumber: page,
        verse: verse,
        keywords: keywords
    }];

    // Button state management
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
            // Reset fields
            document.getElementById('addLibPage').value = '';
            document.getElementById('addLibVerse').value = '';
            document.getElementById('addLibKeywords').value = '';
            // Refresh table if the function exists
            if (typeof loadLibraryTable === "function") loadLibraryTable();
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

async function bulkImport() {
    const textArea = document.getElementById('bulkJson');
    const jsonString = textArea.value.trim();

    if (!jsonString) {
        alert("Please paste some JSON data first.");
        return;
    }

    let payload;
    try {
        payload = JSON.parse(jsonString);
        // Ensure it is an array even if they pasted a single object
        if (!Array.isArray(payload)) {
            payload = [payload];
        }
    } catch (e) {
        alert("Invalid JSON format. Please check your syntax.");
        return;
    }

    // UI Feedback: Change button state
    // We target the button via the event or search for the button inside the modal
    const btn = document.querySelector('#importModal button');
    const originalText = btn.innerText;
    btn.innerText = "Importing...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/LibraryManager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(`✅ Successfully imported ${payload.length} items!`);
            textArea.value = ''; // Clear the box
            // Close the modal if the toggle function exists
            if (typeof toggleImportModal === "function") toggleImportModal();
            // Refresh the table
            if (typeof loadLibraryTable === "function") loadLibraryTable();
        } else {
            const errorText = await res.text();
            alert("❌ Import failed: " + errorText);
        }
    } catch (err) {
        alert("Network Error: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Make it globally available
window.bulkImport = bulkImport;

// Crucial: Bind to window if using type="module"
window.addSingleLibraryItem = addSingleLibraryItem;

// Crucial: Ensure it's globally available

window.showSection = showSection;

/* --- BOOTSTRAP --- */
window.initAdmin = initAdmin;
window.openTab = openTab;
window.searchLibrary = searchLibrary;
window.loadLibraryTable = loadLibraryTable;
window.loadPublic = loadPublic;
window.saveGurudwara = saveGurudwara;
window.deleteGurudwara = deleteGurudwara;
window.triggerPublish = triggerPublish;
window.publishVaak = publishVaak;
window.renderLibraryPage = renderLibraryPage;
window.deleteLibraryItem = deleteLibraryItem;
window.saveEditor = saveEditor;
window.prepareEditGurudwara = prepareEditGurudwara;
window.showSection = showSection;
window.updateEditorLocation = updateEditorLocation;

window.prepareEditEditor = prepareEditEditor;
window.deleteEditor = deleteEditor;

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
