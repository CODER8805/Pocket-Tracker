document.addEventListener('DOMContentLoaded', () => {
    let spendChartInstance = null;

    const themeBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('pocket_theme');
    
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
        if(themeBtn) themeBtn.textContent = '🌙 Dark Mode';
    } else {
        if(themeBtn) themeBtn.textContent = '☀️ Light Mode';
    }
    
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            let theme = 'dark';
            if (document.body.classList.contains('light-theme')) {
                theme = 'light';
                themeBtn.textContent = '🌙 Dark Mode';
            } else {
                themeBtn.textContent = '☀️ Light Mode';
            }
            localStorage.setItem('pocket_theme', theme);
            
            if (document.getElementById('spendChart') && document.getElementById('view-dashboard').classList.contains('active')) {
                initChart();
            }
        });
    }

    const currencyMap = { 'USD': '$', 'INR': '₹', 'EUR': '€', 'GBP': '£' };
    let activeCurrency = localStorage.getItem('pocket_currency') || 'USD';

    function formatMoney(amount) {
        return currencyMap[activeCurrency] + parseFloat(amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    const currSelect = document.getElementById('global-currency');
    if (currSelect) {
        currSelect.value = activeCurrency;
        currSelect.addEventListener('change', (e) => {
            activeCurrency = e.target.value;
            localStorage.setItem('pocket_currency', activeCurrency);
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) activeTab.click(); 
            fetchLoans();
            fetchDreams();
            fetchFixed();
            updateSuperSavings();
        });
    }

    const avatarUpload = document.getElementById('avatar-upload');
    const profilePics = document.querySelectorAll('.profile-pic-render');
    const savedAvatar = localStorage.getItem('pocket_avatar');

    if (savedAvatar) {
        profilePics.forEach(img => { img.src = savedAvatar; img.style.display = 'block'; });
    } else if (window.USER_GENDER && window.USER_NAME) {
        const gen = window.USER_GENDER === 'female' ? 'girl' : 'boy';
        const defaultAvatar = `https://avatar.iran.liara.run/public/${gen}?username=${window.USER_NAME}`;
        profilePics.forEach(img => { img.src = defaultAvatar; img.style.display = 'block'; });
    }

    if (avatarUpload) {
        avatarUpload.addEventListener('change', function(e) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const base64Str = event.target.result;
                localStorage.setItem('pocket_avatar', base64Str);
                profilePics.forEach(img => { img.src = base64Str; img.style.display = 'block'; });
            };
            if(this.files[0]) reader.readAsDataURL(this.files[0]);
        });
    }

    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const profileTrigger = document.getElementById('profile-trigger');

    function switchView(viewName) {
        navItems.forEach(n => n.classList.remove('active'));
        viewSections.forEach(v => v.classList.remove('active'));
        if(profileTrigger) profileTrigger.classList.remove('active');

        const targetView = document.getElementById(`view-${viewName}`);
        if(targetView) targetView.classList.add('active');

        if(viewName === 'dashboard') {
            initChart();
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) fetchExpenses(activeTab.dataset.time);
            updateSuperSavings();
        } else if(viewName === 'fixed') fetchFixed();
        else if(viewName === 'loans') fetchLoans();
        else if(viewName === 'dreams') fetchDreams();
        else if(viewName === 'notifications') fetchNotifications();
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            item.classList.add('active');
            switchView(item.dataset.view);
        });
    });

    if(profileTrigger) {
        profileTrigger.addEventListener('click', () => {
            profileTrigger.classList.add('active');
            switchView('profile');
        });
    }

    const setupModal = (btnId, modalId, formId, submitCallback) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        const form = document.getElementById(formId);
        
        if(btn && modal) btn.addEventListener('click', () => modal.classList.add('active'));
        
        if (modal) {
            modal.querySelectorAll('.close-modal').forEach(c => {
                c.addEventListener('click', () => modal.classList.remove('active'));
            });
        }

        if(form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await submitCallback();
                modal.classList.remove('active');
                form.reset();
            });
        }
    };

    setupModal('open-salary-modal', 'salary-modal', 'salary-form', async () => {
        const salary = document.getElementById('monthly_salary_input').value;
        await fetch('/api/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monthly_salary: salary })
        });
        window.USER_SALARY = parseFloat(salary);
        updateSuperSavings();
    });

    setupModal('open-edit-profile-modal', 'edit-profile-modal', 'edit-profile-form', async () => {
        const name = document.getElementById('edit_name').value;
        const username = document.getElementById('edit_username').value;
        const password = document.getElementById('edit_password').value;
        
        const data = {};
        if(name) data.name = name;
        if(username) data.username = username;
        if(password) data.password = password;
        
        if(Object.keys(data).length > 0) {
            const res = await fetch('/api/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if(result.success) {
                document.getElementById('profile-display-name').textContent = result.name;
                document.getElementById('sidebar-profile-name').textContent = result.name;
                document.getElementById('profile-display-username').textContent = '@' + result.username;
                alert("Profile successfully updated!");
            } else {
                alert(result.error || "Update failed");
            }
        }
    });

    setupModal('open-fixed-modal', 'fixed-modal', 'fixed-form', async () => {
        const data = {
            item_name: document.getElementById('fixed_name').value,
            amount: document.getElementById('fixed_amount').value,
            category: document.getElementById('fixed_category').value,
            due_day: document.getElementById('fixed_due_day').value
        };
        await fetch('/api/fixed_expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        fetchFixed();
    });

    setupModal('open-expense-modal', 'expense-modal', 'expense-form', async () => {
        const data = {
            item_name: document.getElementById('item_name').value,
            amount: document.getElementById('amount').value,
            category: document.getElementById('category').value,
            date: document.getElementById('date').value
        };
        await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) fetchExpenses(activeTab.dataset.time);
        initChart();
        updateSuperSavings();
    });

    setupModal('open-loan-modal', 'loan-modal', 'loan-form', async () => {
        const data = {
            loan_name: document.getElementById('loan_name').value,
            total_amount: document.getElementById('total_amount').value,
            emi_amount: document.getElementById('emi_amount').value,
            due_date: document.getElementById('due_date').value
        };
        await fetch('/api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        fetchLoans();
    });

    setupModal('open-dream-modal', 'dream-modal', 'dream-form', async () => {
        const data = {
            target_name: document.getElementById('target_name').value,
            target_amount: document.getElementById('target_amount').value
        };
        await fetch('/api/dreams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        fetchDreams();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            fetchExpenses(e.target.dataset.time);
        });
    });

    window.deleteItem = async (type, id) => {
        if(confirm(`Remove this entry?`)) {
            await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
            if(type === 'expenses') {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab) fetchExpenses(activeTab.dataset.time);
                initChart();
                updateSuperSavings();
            } else if(type === 'fixed_expenses') fetchFixed();
            else if(type === 'loans') fetchLoans();
            else if(type === 'dreams') fetchDreams();
            else if(type === 'notifications') fetchNotifications();
        }
    };

    const delAccBtn = document.getElementById('delete-account-btn');
    if (delAccBtn) {
        delAccBtn.addEventListener('click', async () => {
            if(confirm("DANGER: This will permanently delete your account and all data. Proceed?")) {
                const phrase = prompt("Type 'DELETE' to confirm:");
                if (phrase === 'DELETE') {
                    await fetch('/api/account', { method: 'DELETE' });
                    localStorage.removeItem('pocket_avatar');
                    window.location.href = '/';
                }
            }
        });
    }

    async function updateSuperSavings() {
        const res = await fetch('/api/expenses/monthly');
        if (res.ok) {
            const data = await res.json();
            const left = (window.USER_SALARY || 0) - data.total;
            
            const savingsDisplay = document.getElementById('super-savings-display');
            const salaryDisplay = document.getElementById('salary-display');
            const savingsCard = document.querySelector('.super-savings-card');
            
            if (savingsDisplay) savingsDisplay.textContent = formatMoney(left);
            if (salaryDisplay) salaryDisplay.textContent = formatMoney(window.USER_SALARY || 0);

            if (left < 0 && savingsCard) {
                savingsCard.classList.add('bleeding-alert');
            } else if (savingsCard) {
                savingsCard.classList.remove('bleeding-alert');
            }
        }
    }

    async function fetchExpenses(timeframe) {
        const list = document.getElementById('expense-list');
        const total = document.getElementById('total-display');
        if(!list) return;
        
        const response = await fetch(`/api/expenses/${timeframe}`);
        if (response.ok) {
            const data = await response.json();
            list.innerHTML = '';
            data.expenses.forEach(exp => {
                list.innerHTML += `
                    <li>
                        <div><strong>${exp.item_name}</strong><br><span>${exp.date}</span></div>
                        <div class="expense-actions">
                            <div class="expense-amount">${formatMoney(exp.amount)}</div>
                            <button class="delete-icon-btn" onclick="deleteItem('expenses', ${exp.id})">Remove</button>
                        </div>
                    </li>
                `;
            });
            total.textContent = formatMoney(data.total);
        }
    }

    async function fetchFixed() {
        const container = document.getElementById('fixed-container');
        if(!container) return;
        const res = await fetch('/api/fixed_expenses');
        const data = await res.json();
        container.innerHTML = data.map(f => `
            <div class="data-card glass-card">
                <h3>${f.item_name}</h3>
                <div class="card-stats">
                    <p>Amount: ${formatMoney(f.amount)}</p>
                    <p>Category: ${f.category}</p>
                    <p class="highlight-text">Due: ${f.due_day} of month</p>
                </div>
                <button class="btn-outline-small delete-card-btn mt-10" onclick="deleteItem('fixed_expenses', ${f.id})">Delete Bill</button>
            </div>
        `).join('');
    }

    async function initChart() {
        const ctx = document.getElementById('spendChart');
        if(!ctx) return;
        
        const isLight = document.body.classList.contains('light-theme');
        const textColor = isLight ? '#475569' : '#94a3b8';
        const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

        const response = await fetch('/api/chart_data');
        const data = await response.json();

        if(spendChartInstance) {
            spendChartInstance.destroy();
        }

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

        spendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Monthly Spend',
                    data: data.data,
                    borderColor: '#38bdf8',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#0f172a',
                    pointBorderColor: '#38bdf8',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false, color: gridColor }, ticks: { color: textColor } },
                    y: { 
                        grid: { color: gridColor }, 
                        ticks: { 
                            color: textColor,
                            callback: function(value) { return formatMoney(value); } 
                        } 
                    }
                }
            }
        });
    }

    async function fetchLoans() {
        const container = document.getElementById('loans-container');
        if(!container) return;
        const res = await fetch('/api/loans');
        const data = await res.json();
        container.innerHTML = data.map(l => `
            <div class="data-card glass-card">
                <h3>${l.loan_name}</h3>
                <div class="card-stats">
                    <p>Total: ${formatMoney(l.total_amount)}</p>
                    <p class="highlight-text">EMI: ${formatMoney(l.emi_amount)}</p>
                    <p>Due: ${l.due_date} of month</p>
                </div>
                <button class="btn-outline-small delete-card-btn mt-10" onclick="deleteItem('loans', ${l.id})">Delete Loan</button>
            </div>
        `).join('');
    }

    async function fetchDreams() {
        const container = document.getElementById('dreams-container');
        if(!container) return;
        const res = await fetch('/api/dreams');
        const data = await res.json();
        
        container.innerHTML = data.map(d => {
            const percent = Math.min((d.saved_amount / d.target_amount) * 100, 100);
            return `
            <div class="data-card glass-card">
                <h3>${d.target_name}</h3>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%"></div>
                </div>
                <p>${formatMoney(d.saved_amount)} / ${formatMoney(d.target_amount)}</p>
                <div class="modal-actions" style="flex-wrap: wrap;">
                    <button class="btn-outline-small mt-10 add-funds-btn" data-id="${d.id}">+ Funds</button>
                    <button class="btn-outline-small mt-10 reduce-funds-btn" data-id="${d.id}">- Funds</button>
                    <button class="btn-outline-small delete-card-btn mt-10" onclick="deleteItem('dreams', ${d.id})">Delete</button>
                </div>
            </div>
        `}).join('');
    }

    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('add-funds-btn')) {
            const id = e.target.dataset.id;
            const amount = prompt("Enter amount to add to dream:");
            if(amount && !isNaN(amount)) {
                await fetch('/api/dreams', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, add_amount: Math.abs(amount) })
                });
                fetchDreams();
            }
        }
        if (e.target.classList.contains('reduce-funds-btn')) {
            const id = e.target.dataset.id;
            const amount = prompt("Enter amount to subtract from dream:");
            if(amount && !isNaN(amount)) {
                await fetch('/api/dreams', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, add_amount: -Math.abs(amount) })
                });
                fetchDreams();
            }
        }
    });

    async function fetchNotifications() {
        const container = document.getElementById('notifications-container');
        if(!container) return;
        const res = await fetch('/api/notifications');
        const data = await res.json();
        container.innerHTML = data.map(n => `
            <div class="notification-item ${n.is_read ? '' : 'unread'}">
                <span class="icon">💬</span>
                <div class="notif-content" style="flex-grow: 1;">
                    <p>${n.message}</p>
                    <small>${n.date}</small>
                </div>
                <button class="delete-icon-btn" onclick="deleteItem('notifications', ${n.id})">✕</button>
            </div>
        `).join('');
    }

    if(document.getElementById('date')) {
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
    }
    
    if(document.querySelector('.app-container')) {
        initChart();
        fetchExpenses('monthly');
        updateSuperSavings();
    }
});