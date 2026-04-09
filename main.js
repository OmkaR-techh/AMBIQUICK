const API_URL = 'http://localhost:3000/api';
let currentUser = null; // { userId, role, fullName }

// Navigation
function navTo(viewId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    // Sidebar active state
    document.querySelectorAll('.sidebar .nav-item').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.querySelector(`.sidebar .nav-item[onclick="navTo('${viewId}')"]`);
    if (navBtn) navBtn.classList.add('active');

    // Extra Data Fetch triggers on Nav
    if (viewId === 'patient-home') fetchPatientHistory();
    if (viewId === 'driver-dashboard') fetchPendingRequests();
}

// Ensure role-based UI limits
function applyRoleUI() {
    if (!currentUser) return;

    const isPatient = currentUser.role === 'patient';
    document.querySelectorAll('.patient-only').forEach(el => el.style.display = isPatient ? '' : 'none');
    document.querySelectorAll('.driver-only').forEach(el => el.style.display = !isPatient ? '' : 'none');

    if (isPatient) {
        document.getElementById('patient-name-display').textContent = currentUser.fullName;
    } else {
        document.getElementById('driver-name-display').textContent = currentUser.fullName;
    }
}

// --- AUTH LOGIC ---
let isSignupMode = false;
function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    document.getElementById('auth-title').textContent = isSignupMode ? "Create an Account" : "Welcome Back";
    document.getElementById('auth-submit-btn').textContent = isSignupMode ? "Sign Up" : "Log In";
    document.getElementById('auth-toggle-btn').textContent = isSignupMode ? "Already have an account? Log in" : "Don't have an account? Sign up";
    document.getElementById('signup-fields').style.display = isSignupMode ? 'block' : 'none';
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    try {
        if (isSignupMode) {
            const role = document.getElementById('auth-role').value;
            const fullName = document.getElementById('auth-name').value;
            const phone = document.getElementById('auth-phone').value;

            const res = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, fullName, email, password, phone })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.error);
            alert("Signup successful! Please log in.");
            toggleAuthMode();
        } else {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.error);

            currentUser = { userId: data.userId, role: data.role, fullName: data.fullName };
            document.getElementById('auth-view').classList.remove('active');
            document.getElementById('app').style.display = 'flex';

            applyRoleUI();
            navTo('landing-view');
        }
    } catch (err) {
        alert("Cannot connect to server. Did you start the Node API?");
    }
});

function logout() {
    currentUser = null;
    document.getElementById('app').style.display = 'none';
    navTo('auth-view');
    document.getElementById('auth-view').classList.add('active');
}

// --- PATIENT: REQUEST & HISTORY ---
async function submitSOS() {
    const pickupLocation = document.getElementById('req-location').value;
    const emergencyType = document.getElementById('req-type').value;
    const notes = document.getElementById('req-notes').value;

    const res = await fetch(`${API_URL}/sos/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: currentUser.userId, pickupLocation, emergencyType, notes })
    });
    const data = await res.json();
    if (res.ok) {
        document.getElementById('dispatch-status').textContent = 'Looking for nearest driver...';
        navTo('live-tracking');
    }
}

async function fetchPatientHistory() {
    const res = await fetch(`${API_URL}/sos/history/${currentUser.userId}`);
    const data = await res.json();

    // Desktop Table
    const tbody = document.getElementById('patient-history-table');
    tbody.innerHTML = '';
    // Mobile Cards
    const cards = document.getElementById('patient-history-cards');
    cards.innerHTML = '';

    data.forEach(req => {
        const date = new Date(req.createdAt).toLocaleDateString();
        // table
        tbody.innerHTML += `
            <tr>
                <td>${date}</td>
                <td><strong>${req.emergencyType}</strong></td>
                <td>${req.pickupLocation}</td>
                <td><span class="status-badge ${req.status}">${req.status.toUpperCase()}</span></td>
            </tr>
        `;
        // cards
        cards.innerHTML += `
            <div class="card activity-card">
                <div class="activity-info">
                    <h4>${req.emergencyType}</h4>
                    <p>${date} • ${req.pickupLocation}</p>
                </div>
                <div class="status-badge ${req.status}">${req.status.toUpperCase()}</div>
            </div>
        `;
    });
}

// --- DRIVER: PENDING & ACCEPT ---
async function fetchPendingRequests() {
    const res = await fetch(`${API_URL}/sos/pending`);
    const data = await res.json();

    const tbody = document.getElementById('driver-pending-table');
    tbody.innerHTML = '';
    const cards = document.getElementById('driver-pending-cards');
    cards.innerHTML = '';

    data.forEach(req => {
        const timeStr = new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Table row Action button
        const actionBtn = `<button class="btn btn-primary" style="padding:8px 16px; font-size:14px;" onclick="viewDriverJob('${req._id}', '${req.pickupLocation}', '${req.patientId.fullName}', '${req.emergencyType}')">View</button>`;

        tbody.innerHTML += `
            <tr>
                <td>${timeStr}</td>
                <td>${req.patientId.fullName}</td>
                <td>${req.pickupLocation}</td>
                <td>${req.emergencyType}</td>
                <td>${actionBtn}</td>
            </tr>
        `;

        // Card action 
        cards.innerHTML += `
            <div class="card activity-card cursor-pointer" onclick="viewDriverJob('${req._id}', '${req.pickupLocation}', '${req.patientId.fullName}', '${req.emergencyType}')">
                <div class="activity-info">
                    <h4>${req.emergencyType} - ${req.patientId.fullName}</h4>
                    <p>${req.pickupLocation}</p>
                </div>
                <div class="status-badge pending">PENDING</div>
            </div>
        `;
    });
}

let currentJobId = null;
function viewDriverJob(id, loc, patientName, type) {
    currentJobId = id;
    const details = document.getElementById('dispatch-action-details');
    details.innerHTML = `
        <div class="req-detail-item">
            <i class='bx bx-map'></i>
            <div><span>Location</span><p>${loc}</p></div>
        </div>
        <div class="req-detail-item">
            <i class='bx bx-user-circle'></i>
            <div><span>Patient</span><p>${patientName} • ${type}</p></div>
        </div>
    `;
    navTo('driver-hub');
}

document.getElementById('accept-job-btn').addEventListener('click', async () => {
    if (!currentJobId) return;
    const res = await fetch(`${API_URL}/sos/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: currentJobId, driverId: currentUser.userId })
    });
    if (res.ok) {
        alert("Job Accepted! Head to pickup location.");
        navTo('driver-dashboard');
    }
});
