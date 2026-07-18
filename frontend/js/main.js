// 綠色循環經濟護照 - 前端主邏輯 (Vanilla JavaScript)

const API_BASE = '/api';

// --- 通用與 Modal 控制 ---
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// 登出
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_location');
    window.location.href = 'index.html';
}

// 檢查認證狀態
function checkAuth() {
    const token = localStorage.getItem('token');
    const isAuthPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('Passport/');
    
    if (!token && !isAuthPage) {
        // 未登入且不在登入頁，強置跳轉
        window.location.href = 'index.html';
    } else if (token && isAuthPage) {
        // 已登入但在登入頁，自動進入收藏庫
        window.location.href = 'passport.html';
    }
}

// 輔助函式：發送 HTTP 請求 (自動附加 JWT Token)
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        // Token 過期或無效，強制登出
        logout();
        throw new Error('認證已過期，請重新登入');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: '未知伺服器錯誤' }));
        throw new Error(errorData.detail || '請求失敗');
    }

    return response.json();
}

// 輔助函式：將檔案轉換為 Base64 字串
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// --- 登入與註冊模組 ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        try {
            errorDiv.style.display = 'none';
            // FastAPI 預設使用 OAuth2 Password Flow，接收 Form Data
            const formData = new URLSearchParams();
            formData.append('username', email); // 依規範，FastAPI OAuth2 username 欄位我們用 email 登入
            formData.append('password', password);

            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || '帳號或密碼錯誤');
            }

            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            // 存入使用者的模糊化位置
            if (data.approx_location) {
                localStorage.setItem('user_location', data.approx_location);
            }
            window.location.href = 'passport.html';
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
        }
    });
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    // 取得瀏覽器定位
    const btnGetLocation = document.getElementById('btnGetLocation');
    btnGetLocation.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('您的瀏覽器不支援定位功能，請手動輸入粗略位置（如郵遞區號）。');
            return;
        }

        btnGetLocation.textContent = '定位中...';
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // 模糊經緯度：保留小數點後 2 位 (精確度約 1 公里，保護隱私)
                const lat = position.coords.latitude.toFixed(2);
                const lon = position.coords.longitude.toFixed(2);
                document.getElementById('regLocation').value = `${lat},${lon}`;
                btnGetLocation.textContent = '取得定位';
            },
            (error) => {
                alert('定位失敗，請手動輸入約略地區或郵遞區號。');
                btnGetLocation.textContent = '取得定位';
            }
        );
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const location = document.getElementById('regLocation').value;
        const errorDiv = document.getElementById('registerError');

        try {
            errorDiv.style.display = 'none';
            await apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password, approx_location: location })
            });

            alert('註冊成功！請登入您的新護照。');
            toggleAuth(false); // 切換回登入區
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
        }
    });
}

// --- 物品護照收藏庫模組 (passport.html) ---
// 物品類型切換顯隱控制
function onCategoryChange() {
    const catEl = document.getElementById('itemCategory');
    if (!catEl) return;
    const category = catEl.value;
    const materialGroup = document.getElementById('itemMaterialGroup');
    const expiryGroup = document.getElementById('itemExpiryGroup');
    const intervalGroup = document.getElementById('itemIntervalGroup');
    const intervalInput = document.getElementById('itemInterval');
    const intervalHint = document.getElementById('itemIntervalHint');

    if (!materialGroup || !expiryGroup || !intervalGroup) return;

    if (category === 'food' || category === 'cosmetics') {
        // 食物、保養品：顯示到期日，隱藏材質、隱藏保養/清洗週期
        materialGroup.style.display = 'none';
        intervalGroup.style.display = 'none';
        expiryGroup.style.display = 'block';
    } else if (category === 'consumables') {
        // 消耗品類：隱藏材質、隱藏到期日、隱藏保養/清洗週期
        materialGroup.style.display = 'none';
        intervalGroup.style.display = 'none';
        expiryGroup.style.display = 'none';
    } else {
        // 硬體家具類、穿戴與裝飾：顯示材質、顯示保養/清洗週期，隱藏到期日
        expiryGroup.style.display = 'none';
        intervalGroup.style.display = 'block';
        materialGroup.style.display = 'block';

        // 根據物品建議幾天要保養，動態設定建議文字與 placeholder
        if (intervalInput && intervalHint) {
            if (category === 'hardware_furniture') {
                intervalHint.textContent = '（建議：180 天）';
                intervalInput.placeholder = '建議：180';
            } else if (category === 'wearables_decor') {
                intervalHint.textContent = '（建議：30 天）';
                intervalInput.placeholder = '建議：30';
            } else {
                intervalHint.textContent = '';
                intervalInput.placeholder = '請輸入天數';
            }
        }
    }
}

// --- 物品護照收藏庫模組 (add-item.html & passport.html) ---
const itemForm = document.getElementById('itemForm');
if (itemForm) {
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const category = document.getElementById('itemCategory').value;
        const rawName = document.getElementById('itemName').value;
        const rawPurchaseDate = document.getElementById('itemPurchaseDate').value;
        const imageFile = document.getElementById('itemImage').files[0];
        const errorDiv = document.getElementById('itemError');

        try {
            errorDiv.style.display = 'none';
            
            // 每個輸入格都不一定要輸入東西，前端做安全預設補齊
            const name = rawName.trim() || '未命名物品';
            const purchase_date = rawPurchaseDate || new Date().toISOString().split('T')[0];
            
            let material = null;
            let estimated_expiry = null;
            let reminder_interval_days = 99999;

            if (category === 'food' || category === 'cosmetics') {
                // 食物或保養品
                material = category === 'food' ? '食物' : '保養品';
                reminder_interval_days = 99999; // 不需要定期提醒保養
                
                const expiryVal = document.getElementById('itemExpiryDate').value;
                if (!expiryVal) {
                    // 若使用者未填到期日期，預設加上 1 年
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 1);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                } else {
                    estimated_expiry = expiryVal;
                }
            } else {
                // 其他類型 (硬體家具類, 消耗品類, 穿戴與裝飾)
                const intervalInput = document.getElementById('itemInterval');
                const intervalVal = intervalInput ? intervalInput.value.trim() : '';

                if (category === 'hardware_furniture') {
                    reminder_interval_days = intervalVal ? parseInt(intervalVal) : 180;
                    if (!intervalVal && intervalInput) intervalInput.value = '180';

                    material = document.getElementById('itemMaterial').value.trim() || '金屬/木質';
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 5);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                } else if (category === 'consumables') {
                    material = '消耗品';
                    reminder_interval_days = 99999; // 消耗品不需要保養/清洗
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 1);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                } else if (category === 'wearables_decor') {
                    reminder_interval_days = intervalVal ? parseInt(intervalVal) : 30;
                    if (!intervalVal && intervalInput) intervalInput.value = '30';

                    material = document.getElementById('itemMaterial').value.trim() || '織物/金屬';
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 10);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                }
            }

            let imageData = null;
            if (imageFile) {
                if (imageFile.size > 500 * 1024) {
                    throw new Error('圖片大小不能超過 500KB！請壓縮相片後重新上傳。');
                }
                imageData = await fileToBase64(imageFile);
            }

            await apiRequest('/items', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    material,
                    purchase_date,
                    estimated_expiry,
                    reminder_interval_days,
                    category,
                    image_data: imageData
                })
            });

            // 成功後跳轉回收藏庫頁面
            window.location.href = 'passport.html';
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
        }
    });
}

// 暫存使用者所有物品
let userItems = [];

// 計算健康度百分比
function getHealthPercent(item) {
    const now = new Date();
    const purchase = new Date(item.purchase_date);
    const expiry = new Date(item.estimated_expiry);
    const total = expiry - purchase;
    const spent = now - purchase;
    if (total <= 0) return 0;
    
    let basePct = 100 - Math.round((spent / total) * 100);
    basePct = Math.max(0, Math.min(100, basePct));
    
    // 根據維修保養紀錄，每筆紀錄增加 15% 健康度獎勵 (封頂 100%)
    const maintenanceCount = (item.records && item.records.length) || 0;
    const bonus = maintenanceCount * 15;
    
    return Math.max(0, Math.min(100, basePct + bonus));
}

// 根據 UI 分類與排序，動態渲染收藏庫列表
function renderFilteredItems() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    const filterVal = document.getElementById('filterCategory').value;
    const sortVal = document.getElementById('sortOption').value;

    // 1. 分類過濾
    let filtered = [...userItems];
    if (filterVal !== 'all') {
        filtered = filtered.filter(item => item.category === filterVal);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                此分類下沒有任何物品，點選導覽列「新增物品護照」開始記錄吧！
            </div>`;
        return;
    }

    // 2. 排序
    filtered.sort((a, b) => {
        if (sortVal === 'date_desc') {
            return b.id - a.id;
        } else if (sortVal === 'date_asc') {
            return a.id - b.id;
        } else if (sortVal === 'expiry_asc') {
            return new Date(a.estimated_expiry) - new Date(b.estimated_expiry);
        } else if (sortVal === 'health_good') {
            return getHealthPercent(b) - getHealthPercent(a);
        } else if (sortVal === 'health_poor') {
            return getHealthPercent(a) - getHealthPercent(b);
        }
        return 0;
    });

    // 3. 渲染
    grid.innerHTML = filtered.map(item => {
        const healthPercent = getHealthPercent(item);

        // 根據健康百分比對應狀態標籤
        let badgeClass = 'badge-good';
        let statusText = '優良';
        if (healthPercent < 40) {
            badgeClass = 'badge-repair';
            statusText = '需保養或維修';
        } else if (healthPercent < 75) {
            badgeClass = 'badge-fair';
            statusText = '良好';
        }

        const imgTag = item.image_data 
            ? `<img src="${item.image_data}" alt="${item.name}">` 
            : `<div class="item-img-placeholder">📦</div>`;

        const intervalText = item.reminder_interval_days >= 90000 
            ? '不需定期保養/清洗' 
            : `${item.reminder_interval_days} 天`;

        return `
            <div class="glass-card item-card">
                <div class="item-img-wrapper">
                    ${imgTag}
                </div>
                <div class="item-content">
                    <div class="item-title">
                        <span>${item.name}</span>
                        <span class="item-badge ${badgeClass}">${statusText}</span>
                    </div>
                    <div class="item-details">
                        類別：${getCategoryText(item.category)}<br>
                        材質：${item.material || '未填'}<br>
                        到期日期：${item.estimated_expiry}<br>
                        定期保養/清洗週期：${intervalText}
                    </div>
                    <div class="health-bar-container">
                        <div class="health-bar-label">
                            <span>物品健康度</span>
                            <span>${healthPercent}%</span>
                        </div>
                        <div class="health-bar-bg">
                            <div class="health-bar-fill" style="width: ${healthPercent}%;"></div>
                        </div>
                    </div>
                    <div class="item-actions" style="display: flex; gap: 0.35rem; justify-content: space-between; flex-wrap: wrap;">
                        <button class="btn-primary btn-sm" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem; flex: 1; text-align: center;" onclick="window.location.href='item-detail.html?id=${item.id}'">履歷</button>
                        ${item.category === 'food' || item.category === 'cosmetics' ? '' : `<button class="btn-primary btn-sm" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem; background: var(--secondary); flex: 1; text-align: center;" onclick="window.location.href='item-maintenance.html?id=${item.id}'">維修</button>`}
                        <button class="btn-primary btn-sm" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem; background: var(--secondary); flex: 1; text-align: center;" onclick="window.location.href='edit-item.html?id=${item.id}'">修改</button>
                        <button class="btn-logout btn-sm" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: rgba(239,68,68,0.3); color:#f87171; flex: 1.2; text-align: center;" onclick="deleteItem(${item.id})">註銷/回收</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// 載入使用者收藏庫物品
async function loadItems() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    try {
        const items = await apiRequest('/items');
        userItems = items;
        renderFilteredItems();
    } catch (err) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">載入失敗: ${err.message}</div>`;
    }
}

// --- 物品護照履歷詳細專頁 (item-detail.html) ---
async function loadItemDetail() {
    const detailContent = document.getElementById('detailContent');
    if (!detailContent) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (!id) {
            detailContent.innerHTML = `<div style="color: #ef4444; text-align: center;">缺少物品 ID 參數！</div>`;
            return;
        }

        const item = await apiRequest(`/items/${id}`);

        // 寫入名稱與狀態標籤 (無 emoji)
        document.getElementById('detailName').textContent = `物品護照履歷：${item.name}`;
        
        const healthPercent = getHealthPercent(item);
        let badgeClass = 'badge-good';
        let statusText = '優良';
        if (healthPercent < 40) {
            badgeClass = 'badge-repair';
            statusText = '需保養或維修';
        } else if (healthPercent < 75) {
            badgeClass = 'badge-fair';
            statusText = '良好';
        }
        
        const statusSpan = document.getElementById('detailStatus');
        statusSpan.className = `item-badge ${badgeClass}`;
        statusSpan.textContent = statusText;

        const advice = item.circular_advice || {
            carbon_emissions: '3.0 kg CO2e',
            resale_estimate: '暫無估價',
            donation_channel: '暫無推薦管道',
            recycling_category: '一般廢棄物分類處理'
        };

        const imgHtml = item.image_data 
            ? `<div style="text-align: center; margin-bottom: 1.5rem;"><img src="${item.image_data}" alt="${item.name}" style="max-width: 100%; max-height: 250px; border-radius: 12px; border: 1px solid var(--border-color);"></div>`
            : '';

        const isFoodOrCosmetics = item.category === 'food' || item.category === 'cosmetics';

        let innerGridHtml = '';
        if (isFoodOrCosmetics) {
            innerGridHtml = `
                <div class="glass-card" style="padding: 1.25rem; grid-column: 1/-1;">
                    <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--primary);">基本護照規格</div>
                    <div style="line-height: 1.8; font-size: 0.95rem;">
                        <strong>物品分類：</strong> ${getCategoryText(item.category)}<br>
                        <strong>主要材質：</strong> ${item.material || '未填'}<br>
                        <strong>購買日期：</strong> ${item.purchase_date}<br>
                        <strong>到期日期：</strong> ${item.estimated_expiry}
                    </div>
                </div>
            `;
        } else {
            innerGridHtml = `
                <div class="glass-card" style="padding: 1.25rem;">
                    <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--primary);">基本護照規格</div>
                    <div style="line-height: 1.8; font-size: 0.95rem;">
                        <strong>物品分類：</strong> ${getCategoryText(item.category)}<br>
                        <strong>主要材質：</strong> ${item.material || '未填'}<br>
                        <strong>購買日期：</strong> ${item.purchase_date}<br>
                        <strong>到期日期：</strong> ${item.estimated_expiry}
                    </div>
                </div>
                <div class="glass-card" style="padding: 1.25rem;">
                    <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--primary);">二手殘值與減碳足跡</div>
                    <div style="line-height: 1.8; font-size: 0.95rem;">
                        <strong>預估剩餘價值：</strong> <span style="color: var(--accent); font-weight: 700; font-size: 1.1rem;">${advice.resale_estimate}</span><br>
                        <strong>預估碳足跡：</strong> <span style="color: var(--primary); font-weight: 700; font-size: 1.1rem;">${advice.carbon_emissions}</span><br>
                        <small style="color: var(--text-muted); display: block; margin-top: 0.5rem; line-height: 1.4;">
                            * 二手殘值會隨使用時間進行折舊遞減。延長保養能提升健康度，維持價值。
                        </small>
                    </div>
                </div>
                <div class="glass-card" style="padding: 1.25rem; grid-column: 1/-1;">
                    <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--primary);">綠色循環處置指引</div>
                    <div style="line-height: 1.8; font-size: 0.95rem;">
                        <strong>推薦捐贈管道：</strong> ${advice.donation_channel}<br>
                        <strong>推薦回收分類：</strong> ${advice.recycling_category}
                    </div>
                </div>
            `;
        }

        detailContent.innerHTML = `
            ${imgHtml}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                ${innerGridHtml}
            </div>
        `;
    } catch (err) {
        detailContent.innerHTML = `<div style="color: #ef4444; text-align: center;">載入失敗: ${err.message}</div>`;
    }
}

// --- 物品維修紀錄與新增專頁 (item-maintenance.html) ---
async function loadMaintenancePage() {
    const detailRecords = document.getElementById('detailRecords');
    if (!detailRecords) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (!id) {
            detailRecords.innerHTML = `<div style="color: #ef4444; text-align: center;">缺少物品 ID 參數！</div>`;
            return;
        }

        const item = await apiRequest(`/items/${id}`);

        if (item.category === 'food' || item.category === 'cosmetics') {
            alert('此種類的物品（食物/保養品）不提供維修紀錄與保養服務！');
            window.location.href = 'passport.html';
            return;
        }

        // 寫入名稱與隱藏欄位
        document.getElementById('maintenanceTitle').textContent = `新增維修保養紀錄：${item.name}`;
        document.getElementById('recordItemId').value = item.id;

        // 載入歷史紀錄 (無 emoji)
        if (item.records && item.records.length > 0) {
            detailRecords.innerHTML = item.records.map(rec => `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; font-size: 0.9rem;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-main);">
                        <span>日期：${rec.maintenance_date}</span>
                        <span style="color: var(--accent);">費用：NTD ${rec.cost}</span>
                    </div>
                    <div style="color: var(--text-muted);">${rec.description}</div>
                </div>
            `).join('');
        } else {
            detailRecords.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size: 0.9rem; padding: 2rem;">目前尚無維修紀錄。</div>`;
        }
    } catch (err) {
        detailRecords.innerHTML = `<div style="color: #ef4444; text-align: center;">載入失敗: ${err.message}</div>`;
    }
}

// 註冊維修表單事件
const recordForm = document.getElementById('recordForm');
if (recordForm) {
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('recordItemId').value;
        const date = document.getElementById('recordDate').value;
        const cost = parseFloat(document.getElementById('recordCost').value);
        const desc = document.getElementById('recordDesc').value;

        try {
            await apiRequest(`/items/${id}/maintenance`, {
                method: 'POST',
                body: JSON.stringify({
                    maintenance_date: date,
                    cost,
                    description: desc
                })
            });

            // 重新刷新本頁的維修歷史列表，並清空表單
            loadMaintenancePage();
            recordForm.reset();
            
            // 預設將維修日期設為今天
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('recordDate').value = today;
        } catch (err) {
            alert(err.message);
        }
    });
}

// 重構註銷物品護照流程為選擇處置管道
async function deleteItem(id) {
    const item = userItems.find(it => it.id === id);
    if (!item) return;

    // 將資料寫入 decommission modal 中
    document.getElementById('decommissionItemId').value = id;
    document.getElementById('decommissionItemName').textContent = item.name;
    openModal('decommissionModal');
}

// 提交特定的處置方式
async function submitDecommission(action) {
    const id = document.getElementById('decommissionItemId').value;
    if (!id) return;

    try {
        await apiRequest(`/items/${id}?action=${action}`, { method: 'DELETE' });
        closeModal('decommissionModal');
        loadItems();
        loadESGStats();
    } catch (err) {
        alert('處置註銷失敗: ' + err.message);
    }
}

let esgStatsCache = null;

// 載入與更新 ESG 綠色永續儀表板數據
async function loadESGStats() {
    const ptsEl = document.getElementById('esgPoints');
    const carbEl = document.getElementById('esgCarbon');
    const postsEl = document.getElementById('esgPostsCount');
    const circEl = document.getElementById('esgCircularCount');

    // 只有在 passport.html 頁面才執行更新
    if (!ptsEl) return;

    try {
        const stats = await apiRequest('/items/esg-stats');
        esgStatsCache = stats; // 快取統計明細資料
        
        ptsEl.textContent = stats.total_points;
        carbEl.textContent = `${stats.total_carbon_saved} kg`;
        if (postsEl) postsEl.textContent = stats.post_history.length;
        circEl.textContent = stats.recycled_count + stats.donated_count + stats.sold_count + stats.discarded_count;
    } catch (err) {
        console.error('載入 ESG 數據失敗:', err);
    }
}

// 彈出 ESG 項目詳細歷史紀錄
function showESGDetail(type) {
    if (!esgStatsCache) {
        alert('正在載入數據中，請稍候...');
        return;
    }

    const titleEl = document.getElementById('esgDetailTitle');
    const bodyEl = document.getElementById('esgDetailBody');
    if (!titleEl || !bodyEl) return;

    let titleText = '';
    let htmlContent = '';

    if (type === 'points') {
        titleText = '🌱 綠色永續積分明細';
        const list = esgStatsCache.points_detail || [];
        if (list.length === 0) {
            htmlContent = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">目前尚無積分紀錄。</div>`;
        } else {
            htmlContent = `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--primary); font-weight: 600;">
                            <th style="padding: 0.75rem 0.5rem;">物品名稱</th>
                            <th style="padding: 0.75rem 0.5rem;">動作類型</th>
                            <th style="padding: 0.75rem 0.5rem;">詳情備註</th>
                            <th style="padding: 0.75rem 0.5rem; text-align: right;">獲得積分</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(item => `
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-main);">
                                <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${item.name}</td>
                                <td style="padding: 0.75rem 0.5rem; color: var(--accent); font-weight: 600;">${item.action}</td>
                                <td style="padding: 0.75rem 0.5rem; color: var(--text-muted);">${item.detail || '無'}</td>
                                <td style="padding: 0.75rem 0.5rem; text-align: right; color: var(--accent); font-weight: 700;">+${item.points}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } else if (type === 'carbon') {
        titleText = '💨 累計減碳效益明細';
        const list = esgStatsCache.carbon_detail || [];
        if (list.length === 0) {
            htmlContent = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">目前尚無減碳效益紀錄。</div>`;
        } else {
            htmlContent = `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--primary); font-weight: 600;">
                            <th style="padding: 0.75rem 0.5rem;">物品名稱</th>
                            <th style="padding: 0.75rem 0.5rem;">減碳動作</th>
                            <th style="padding: 0.75rem 0.5rem; text-align: right;">碳排節省量</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(item => `
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-main);">
                                <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${item.name}</td>
                                <td style="padding: 0.75rem 0.5rem; color: var(--accent);">${item.action}</td>
                                <td style="padding: 0.75rem 0.5rem; text-align: right; color: var(--primary); font-weight: 700;">${item.carbon} kg CO2e</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } else if (type === 'posts') {
        titleText = '📢 交易與募集貼文歷史';
        const list = esgStatsCache.post_history || [];
        if (list.length === 0) {
            htmlContent = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">目前尚無發布募集或交易的貼文紀錄。</div>`;
        } else {
            htmlContent = `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--primary); font-weight: 600;">
                            <th style="padding: 0.75rem 0.5rem;">貼文標題</th>
                            <th style="padding: 0.75rem 0.5rem;">貼文類型</th>
                            <th style="padding: 0.75rem 0.5rem;">目前狀態</th>
                            <th style="padding: 0.75rem 0.5rem; text-align: right;">發布日期</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(item => `
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-main);">
                                <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${item.title}</td>
                                <td style="padding: 0.75rem 0.5rem; color: var(--accent);">${item.post_type}</td>
                                <td style="padding: 0.75rem 0.5rem;"><span class="item-badge ${item.status === '進行中' ? 'badge-good' : 'badge-fair'}" style="font-size: 0.75rem;">${item.status}</span></td>
                                <td style="padding: 0.75rem 0.5rem; text-align: right; color: var(--text-muted);">${item.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } else if (type === 'circular') {
        titleText = '♻️ 循環處理物品明細';
        const list = esgStatsCache.circular_detail || [];
        if (list.length === 0) {
            htmlContent = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">目前尚無已循環處理的物品。</div>`;
        } else {
            htmlContent = `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--primary); font-weight: 600;">
                            <th style="padding: 0.75rem 0.5rem;">物品名稱</th>
                            <th style="padding: 0.75rem 0.5rem;">循環處理方式</th>
                            <th style="padding: 0.75rem 0.5rem;">主要材質</th>
                            <th style="padding: 0.75rem 0.5rem; text-align: right;">處置日期</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(item => `
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-main);">
                                <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${item.name}</td>
                                <td style="padding: 0.75rem 0.5rem; color: var(--accent); font-weight: 600;">${item.action}</td>
                                <td style="padding: 0.75rem 0.5rem; color: var(--text-muted);">${getCategoryText(item.category)} (${item.material || '未填'})</td>
                                <td style="padding: 0.75rem 0.5rem; text-align: right; color: var(--text-muted);">${item.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    titleEl.textContent = titleText;
    bodyEl.innerHTML = htmlContent;
    openModal('esgDetailModal');
}

// 類別文字中文化翻譯對照
function getCategoryText(category) {
    const mapping = {
        'hardware_furniture': '硬體家具類',
        'consumables': '消耗品類',
        'food': '食物',
        'cosmetics': '保養品',
        'wearables_decor': '穿戴與裝飾'
    };
    return mapping[category] || category || '未分類';
}

// 載入獨立提醒頁面 (reminders.html)
async function loadRemindersPage() {
    const list = document.getElementById('remindersList');
    const descEl = document.getElementById('remindersDesc');
    const titleEl = document.getElementById('remindersTitle');
    const adviceCard = document.getElementById('remindersAdviceCard');
    const adviceTextDiv = document.getElementById('remindersAdviceText');

    if (!list) return;

    try {
        const reminders = await apiRequest('/items/reminders');
        if (reminders.length === 0) {
            if (descEl) descEl.textContent = '目前沒有任何即將到期或需要保養的物品';
            list.innerHTML = '';
            if (titleEl) titleEl.textContent = '⏰ 提醒通知';
            if (adviceCard) adviceCard.style.display = 'none';
            return;
        }

        const categories = new Set(reminders.map(item => item.category));
        const hasExpiryOnly = Array.from(categories).every(cat => cat === 'food' || cat === 'cosmetics' || cat === 'consumables');
        const hasMaintenanceOnly = Array.from(categories).every(cat => cat !== 'food' && cat !== 'cosmetics' && cat !== 'consumables');

        if (titleEl) {
            if (hasExpiryOnly) {
                titleEl.textContent = '⏰ 物品到期提醒';
            } else if (hasMaintenanceOnly) {
                titleEl.textContent = '⏰ 物品保養維護提醒';
            } else {
                titleEl.textContent = '⏰ 物品保養與到期提醒';
            }
        }

        if (descEl) {
            if (hasExpiryOnly) {
                descEl.textContent = '提醒您，以下物品即將到期：';
            } else if (hasMaintenanceOnly) {
                descEl.textContent = '提醒您，以下物品已達到設定的定期保養時間！延長物品的使用壽命可以減少環境的碳負擔：';
            } else {
                descEl.textContent = '提醒您，以下物品即將到期或已達到設定的定期保養時間！延長物品的使用壽命可以減少環境的碳負擔：';
            }
        }

        // 根據物品類別動態渲染提醒內容
        list.innerHTML = reminders.map(item => {
            if (item.category === 'food') {
                return `<li>⚠️ ${item.name} 於 ${item.estimated_expiry} 即將到期，請儘速食用！</li>`;
            } else if (item.category === 'cosmetics') {
                return `<li>⚠️ ${item.name} 於 ${item.estimated_expiry} 即將到期，請儘速使用！</li>`;
            } else if (item.category === 'consumables') {
                return `<li>⚠️ ${item.name} 於 ${item.estimated_expiry} 即將到期，請儘速使用完畢！</li>`;
            } else {
                const matText = item.material ? ` (材質: ${item.material})` : '';
                return `<li>⚠️ ${item.name}${matText} 於 ${item.estimated_expiry} 已達保養時間，需進行維護！</li>`;
            }
        }).join('');

        // 動態生成保養與使用建議
        if (adviceCard && adviceTextDiv) {
            let advices = [];
            const hasHardwareOrWearables = Array.from(categories).some(cat => cat !== 'food' && cat !== 'cosmetics' && cat !== 'consumables');

            if (hasHardwareOrWearables) {
                advices.push(`🛠️ <strong>硬體/穿戴保養</strong>：適度清潔物品表面、為金屬關節上防鏽油、或是鎖緊鬆動的螺絲扣件，可以為物品延長 1~3 年的壽命！`);
            }
            if (categories.has('food')) {
                advices.push(`🍎 <strong>食品存放建議</strong>：食品類物品即將過期，請注意存放環境與保存期限，並儘速食用完畢以避免浪費！`);
            }
            if (categories.has('cosmetics')) {
                advices.push(`🧴 <strong>保養品建議</strong>：保養品與化妝品類即將過期，請存放於避光陰涼處，並於有效期限內儘速使用完畢以防變質！`);
            }
            if (categories.has('consumables')) {
                advices.push(`🔋 <strong>消耗品建議</strong>：消耗品類即將過期，請妥善規劃使用時程，避免囤積導致過期失效！`);
            }

            if (advices.length > 0) {
                adviceTextDiv.innerHTML = advices.map((adv, idx) => `<p style="${idx < advices.length - 1 ? 'margin-bottom: 0.5rem;' : ''}">${adv}</p>`).join('');
                adviceCard.style.display = 'block';
            } else {
                adviceCard.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('提醒載入失敗:', err);
        if (descEl) descEl.textContent = '載入提醒資料失敗，請稍後再試。';
    }
}

// 檢查保養提醒 (passport.html 載入時自動執行)
async function checkReminders() {
    const list = document.getElementById('reminderList');
    if (!list) return;

    try {
        const reminders = await apiRequest('/items/reminders');
        if (reminders.length > 0) {
            const categories = new Set(reminders.map(item => item.category));

            // 動態更新提醒標題與描述文字
            const titleEl = document.getElementById('reminderTitle');
            const descEl = document.getElementById('reminderDesc');
            if (titleEl || descEl) {
                const hasExpiryOnly = Array.from(categories).every(cat => cat === 'food' || cat === 'cosmetics' || cat === 'consumables');
                const hasMaintenanceOnly = Array.from(categories).every(cat => cat !== 'food' && cat !== 'cosmetics' && cat !== 'consumables');

                if (titleEl) {
                    if (hasExpiryOnly) {
                        titleEl.textContent = '⏰ 物品到期提醒';
                    } else if (hasMaintenanceOnly) {
                        titleEl.textContent = '⏰ 物品保養維護提醒';
                    } else {
                        titleEl.textContent = '⏰ 物品保養與到期提醒';
                    }
                }

                if (descEl) {
                    if (hasExpiryOnly) {
                        descEl.textContent = '提醒您，以下物品即將到期：';
                    } else if (hasMaintenanceOnly) {
                        descEl.textContent = '提醒您，以下物品已達到設定的定期保養時間！延長物品的使用壽命可以減少環境的碳負擔：';
                    } else {
                        descEl.textContent = '提醒您，以下物品即將到期或已達到設定的定期保養時間！延長物品的使用壽命可以減少環境的碳負擔：';
                    }
                }
            }

            // 根據物品類別動態渲染提醒內容
            list.innerHTML = reminders.map(item => {
                if (item.category === 'food') {
                    return `<li>⚠️ ${item.name} 於 ${item.estimated_expiry} 即將到期，請儘速食用！</li>`;
                } else if (item.category === 'cosmetics') {
                    return `<li>⚠️ ${item.name} 於 ${item.estimated_expiry} 即將到期，請儘速使用！</li>`;
                } else if (item.category === 'consumables') {
                    return `<li>⚠️ ${item.name} 於 ${item.estimated_expiry} 即將到期，請儘速使用完畢！</li>`;
                } else {
                    const matText = item.material ? ` (材質: ${item.material})` : '';
                    return `<li>⚠️ ${item.name}${matText} 於 ${item.estimated_expiry} 已達保養時間，需進行維護！</li>`;
                }
            }).join('');

            // 動態生成保養與使用建議
            const adviceCard = document.getElementById('reminderAdviceCard');
            const adviceTextDiv = document.getElementById('reminderAdviceText');
            if (adviceCard && adviceTextDiv) {
                let advices = [];

                const hasHardwareOrWearables = Array.from(categories).some(cat => cat !== 'food' && cat !== 'cosmetics' && cat !== 'consumables');

                if (hasHardwareOrWearables) {
                    advices.push(`🛠️ <strong>硬體/穿戴保養</strong>：適度清潔物品表面、為金屬關節上防鏽油、或是鎖緊鬆動的螺絲扣件，可以為物品延長 1~3 年的壽命！`);
                }
                if (categories.has('food')) {
                    advices.push(`🍎 <strong>食品存放建議</strong>：食品類物品即將過期，請注意存放環境與保存期限，並儘速食用完畢以避免浪費！`);
                }
                if (categories.has('cosmetics')) {
                    advices.push(`🧴 <strong>保養品建議</strong>：保養品與化妝品類即將過期，請存放於避光陰涼處，並於有效期限內儘速使用完畢以防變質！`);
                }
                if (categories.has('consumables')) {
                    advices.push(`🔋 <strong>消耗品建議</strong>：消耗品類即將過期，請妥善規劃使用時程，避免囤積導致過期失效！`);
                }

                if (advices.length > 0) {
                    adviceTextDiv.innerHTML = advices.map((adv, idx) => `<p style="${idx < advices.length - 1 ? 'margin-bottom: 0.5rem;' : ''}">${adv}</p>`).join('');
                    adviceCard.style.display = 'block';
                } else {
                    adviceCard.style.display = 'none';
                }
            }

            openModal('reminderModal');
        }
    } catch (err) {
        console.error('提醒檢查失敗:', err);
    }
}

// --- 物品編輯修改模組 (edit-item.html) ---
async function loadEditPage() {
    const editForm = document.getElementById('editForm');
    if (!editForm) return;

    const errorDiv = document.getElementById('itemError');
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (!id) {
            alert('缺少編輯物品的 ID 參數！');
            window.location.href = 'passport.html';
            return;
        }

        const item = await apiRequest(`/items/${id}`);

        document.getElementById('editItemId').value = item.id;
        document.getElementById('itemCategory').value = item.category || 'hardware_furniture';
        document.getElementById('itemName').value = item.name || '';
        document.getElementById('itemMaterial').value = item.material || '';
        document.getElementById('itemPurchaseDate').value = item.purchase_date || '';
        document.getElementById('itemExpiryDate').value = item.estimated_expiry || '';
        document.getElementById('itemInterval').value = item.reminder_interval_days || 30;

        // 觸發一次顯隱調整
        onCategoryChange();
    } catch (err) {
        alert('載入編輯資料失敗: ' + err.message);
        window.location.href = 'passport.html';
    }
}

const editForm = document.getElementById('editForm');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editItemId').value;
        const category = document.getElementById('itemCategory').value;
        const rawName = document.getElementById('itemName').value;
        const rawPurchaseDate = document.getElementById('itemPurchaseDate').value;
        const imageFile = document.getElementById('itemImage').files[0];
        const errorDiv = document.getElementById('itemError');

        try {
            errorDiv.style.display = 'none';

            // 空值安全預設補齊
            const name = rawName.trim() || '未命名物品';
            const purchase_date = rawPurchaseDate || new Date().toISOString().split('T')[0];

            let material = null;
            let estimated_expiry = null;
            let reminder_interval_days = 99999;

            if (category === 'food' || category === 'cosmetics') {
                material = category === 'food' ? '食物' : '保養品';
                reminder_interval_days = 99999;
                
                const expiryVal = document.getElementById('itemExpiryDate').value;
                if (!expiryVal) {
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 1);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                } else {
                    estimated_expiry = expiryVal;
                }
            } else {
                // 其他類型 (硬體家具類, 消耗品類, 穿戴與裝飾)
                const intervalInput = document.getElementById('itemInterval');
                const intervalVal = intervalInput ? intervalInput.value.trim() : '';

                if (category === 'hardware_furniture') {
                    reminder_interval_days = intervalVal ? parseInt(intervalVal) : 180;
                    if (!intervalVal && intervalInput) intervalInput.value = '180';

                    material = document.getElementById('itemMaterial').value.trim() || '金屬/木質';
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 5);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                } else if (category === 'consumables') {
                    material = '消耗品';
                    reminder_interval_days = 99999;
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 1);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                } else if (category === 'wearables_decor') {
                    reminder_interval_days = intervalVal ? parseInt(intervalVal) : 30;
                    if (!intervalVal && intervalInput) intervalInput.value = '30';

                    material = document.getElementById('itemMaterial').value.trim() || '織物/金屬';
                    const pDate = new Date(purchase_date);
                    pDate.setFullYear(pDate.getFullYear() + 10);
                    estimated_expiry = pDate.toISOString().split('T')[0];
                }
            }

            let imageData = null;
            if (imageFile) {
                if (imageFile.size > 500 * 1024) {
                    throw new Error('圖片大小不能超過 500KB！請壓縮相片後重新上傳。');
                }
                imageData = await fileToBase64(imageFile);
            }

            await apiRequest(`/items/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name,
                    material,
                    purchase_date,
                    estimated_expiry,
                    reminder_interval_days,
                    category,
                    image_data: imageData
                })
            });

            window.location.href = 'passport.html';
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
        }
    });
}

// --- 互助募集與二手交易看板模組 (board.html) ---
let userPosts = [];

// 交易類型切換顯隱與標題控制
function onPostTradingTypeChange() {
    const tradingType = document.getElementById('postTradingType').value;
    const conditionGroup = document.getElementById('postConditionGroup');
    const conditionInput = document.getElementById('postCondition');
    const modalTitle = document.getElementById('postModalTitle');
    const titleLabel = document.getElementById('postTitleLabel');
    const contentLabel = document.getElementById('postContentLabel');

    if (!conditionGroup || !conditionInput) return;

    if (tradingType === 'Trade') {
        conditionGroup.style.display = 'block';
        conditionInput.required = true;
        if (modalTitle) modalTitle.textContent = '📢 建立二手交易與贈送公告';
        if (titleLabel) titleLabel.textContent = '交易物品名稱';
        if (contentLabel) contentLabel.textContent = '物品使用狀況與交易地點/聯絡方式';
    } else {
        conditionGroup.style.display = 'none';
        conditionInput.required = false;
        conditionInput.value = '';
        if (modalTitle) modalTitle.textContent = '📢 建立微型零件募集貼文';
        if (titleLabel) titleLabel.textContent = '募集標題';
        if (contentLabel) contentLabel.textContent = '募集說明與規格';
    }
}

// 看板篩選變更事件，動態調整排序下拉選項
function onBoardFilterChange() {
    const filterType = document.getElementById('boardFilterType').value;
    const sortSelect = document.getElementById('boardSortOption');
    if (!sortSelect) return;

    // 清空舊選項
    sortSelect.innerHTML = '';

    if (filterType === 'Trade') {
        // 二手交易專屬排序選項
        sortSelect.innerHTML = `
            <option value="dist_asc" selected>距離優先</option>
            <option value="time_desc">最新發布</option>
            <option value="price_asc">二手金額 (低 ➔ 高) 💰</option>
            <option value="price_desc">二手金額 (高 ➔ 低) 💰</option>
            <option value="health_desc">物品健康度 (良好優先)</option>
            <option value="carbon_asc">碳足跡 (低碳優先)</option>
        `;
    } else {
        // 微型募集或全部，僅顯示距離與時間
        sortSelect.innerHTML = `
            <option value="dist_asc" selected>距離優先</option>
            <option value="time_desc">最新發布</option>
        `;
    }

    renderBoardItems();
}

// 留言發佈功能
async function addComment(postId) {
    const input = document.getElementById(`commentInput-${postId}`);
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    try {
        await apiRequest(`/board/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        input.value = '';
        loadPosts(); // 重新整理卡片顯示最新留言
    } catch (err) {
        alert('發表留言失敗: ' + err.message);
    }
}

// 刪除貼文功能
async function deletePost(postId) {
    if (!confirm('您確定要刪除這篇貼文嗎？此操作將無法復原。')) return;
    try {
        await apiRequest(`/board/posts/${postId}`, {
            method: 'DELETE'
        });
        alert('貼文已成功刪除！');
        loadPosts();
    } catch (err) {
        alert('刪除貼文失敗: ' + err.message);
    }
}

// 載入看板貼文
async function loadPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;

    try {
        const location = localStorage.getItem('user_location') || '';
        const posts = await apiRequest(`/board/posts?user_location=${encodeURIComponent(location)}`);
        userPosts = posts;
        renderBoardItems();
    } catch (err) {
        container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 2rem;">載入失敗: ${err.message}</div>`;
    }
}

// 渲染看板卡片 (包含前端搜尋、篩選與多維度排序)
function renderBoardItems() {
    const container = document.getElementById('postsContainer');
    if (!container) return;

    const query = document.getElementById('boardSearch').value.trim().toLowerCase();
    const filterType = document.getElementById('boardFilterType').value;
    const sortVal = document.getElementById('boardSortOption').value;

    // 1. 篩選與搜尋
    let filtered = [...userPosts];
    
    // 類型篩選
    if (filterType !== 'all') {
        filtered = filtered.filter(p => p.post_type === filterType);
    }

    // 關鍵字搜尋
    if (query) {
        filtered = filtered.filter(p => 
            (p.title || '').toLowerCase().includes(query) || 
            (p.content || '').toLowerCase().includes(query) || 
            (p.item_type || '').toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: var(--text-muted);">
                沒有找到符合條件的貼文。您也可以發布公告喔！
            </div>`;
        return;
    }

    // 2. 排序
    filtered.sort((a, b) => {
        if (sortVal === 'dist_asc') {
            return 0; // 保持後端近➔遠的 Haversine 原生排序
        } else if (sortVal === 'time_desc') {
            return b.id - a.id;
        } else if (sortVal === 'price_asc') {
            return (a.price || 0.0) - (b.price || 0.0);
        } else if (sortVal === 'price_desc') {
            return (b.price || 0.0) - (a.price || 0.0);
        } else if (sortVal === 'health_desc') {
            return (b.item_health || 100) - (a.item_health || 100);
        } else if (sortVal === 'carbon_asc') {
            return (a.item_carbon || 0.0) - (b.item_carbon || 0.0);
        }
        return 0;
    });

    // 3. 渲染 DOM (顯示照片與價格/健康度等，無 emoji 按鈕)
    container.innerHTML = filtered.map(post => {
        let typeBadge = '';
        let extraInfoHtml = '';

        if (post.post_type === 'Trade') {
            typeBadge = `<span class="item-badge" style="background: rgba(16,185,129,0.12); color: #059669; font-size:0.8rem; padding: 0.15rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; font-weight:600;">交易 | 條件: ${post.price_or_condition}</span>`;
            extraInfoHtml = `
                <div class="glass-card" style="padding: 0.75rem; margin-bottom: 1rem; font-size: 0.85rem; border-color: rgba(16,185,129,0.15); background: rgba(16,185,129,0.02); display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem;">
                    <div>💰 <strong>交易金額：</strong> NTD ${post.price}</div>
                    <div>💚 <strong>物品健康度：</strong> ${post.item_health}%</div>
                    <div>🌱 <strong>預估碳足跡：</strong> ${post.item_carbon} kg CO2e</div>
                </div>
            `;
        } else {
            typeBadge = `<span class="item-badge" style="background: rgba(217,119,6,0.12); color: #d97706; font-size:0.8rem; padding: 0.15rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; font-weight:600;">募集</span>`;
        }

        const imgTag = post.image_data 
            ? `<div style="margin-bottom: 1rem; text-align: center;"><img src="${post.image_data}" alt="${post.title}" style="max-width: 100%; max-height: 300px; border-radius: 12px; border: 1px solid var(--border-color);"></div>`
            : '';

        const commentsHtml = post.comments && post.comments.length > 0
            ? post.comments.map(c => `
                <div style="margin-bottom: 0.4rem; font-size: 0.85rem; line-height: 1.4; border-bottom: 1px solid rgba(16,185,129,0.05); padding-bottom: 0.25rem; color: var(--text-main);">
                    <span style="color: var(--secondary); font-weight: 600;">${c.username}</span>：
                    <span>${c.content}</span>
                </div>
            `).join('')
            : `<div style="text-align:center; color:var(--text-muted); font-size: 0.8rem; padding: 0.5rem 0;">目前暫無回覆，成為第一個幫忙的人吧！</div>`;

        const chatBadge = post.distance_text !== '本人發布'
            ? `<span class="item-badge" style="background: rgba(2,132,199,0.12); color: #0284c7; cursor: pointer; font-size:0.8rem; padding: 0.15rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; font-weight:600; border: 1px solid rgba(2,132,199,0.3);" onclick="window.location.href='messages.html?chat_with=${post.user_id}&post_id=${post.id}'">💬 私訊聯絡</span>`
            : '';

        const deleteBtn = post.distance_text === '本人發布'
            ? `<span class="item-badge" style="background: rgba(239,68,68,0.12); color: #ef4444; cursor: pointer; font-size:0.8rem; padding: 0.15rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; font-weight:600; border: 1px solid rgba(239,68,68,0.3);" onclick="deletePost(${post.id})">🗑️ 刪除貼文</span>`
            : '';

        return `
            <div class="glass-card post-card" style="margin-bottom: 1.5rem;">
                <div class="post-header" style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    <span class="post-author" style="font-weight:600; color: var(--text-main);">👤 ${post.username} ${typeBadge} ${chatBadge}</span>
                    <div style="display: flex; align-items: center;">
                        <span class="post-dist" style="font-size:0.8rem; background: rgba(16,185,129,0.1); color: var(--secondary); padding: 0.2rem 0.5rem; border-radius: 4px;">📍 ${post.distance_text || '位置不詳'}</span>
                        ${deleteBtn}
                    </div>
                </div>
                
                <div style="font-weight: 700; font-size: 1.15rem; margin-bottom: 0.75rem; color: var(--text-main)">
                    ${post.title} (類別: ${post.item_type})
                </div>

                ${imgTag}
                ${extraInfoHtml}

                <div class="post-body" style="font-size: 0.95rem; margin-bottom: 1rem; color: var(--text-muted); line-height: 1.6; white-space: pre-wrap;">
                    ${post.content}
                </div>

                <div style="font-size: 0.75rem; color: var(--text-muted); display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                    <span>狀態: ${post.status === 'Open' ? '🟢 進行中' : '🔴 已結案'}</span>
                    <span>發布時間: ${post.created_at.split('T')[0]}</span>
                </div>
                
                <!-- 留言區 -->
                <div style="background: rgba(255,255,255,0.4); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; margin-top: 0.5rem;">
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem;">💬 鄰里回覆交流</div>
                    <div class="comments-container" style="max-height: 200px; overflow-y: auto; margin-bottom: 0.75rem; padding-right: 0.25rem;">
                        ${commentsHtml}
                    </div>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <input type="text" id="commentInput-${post.id}" class="form-control" placeholder="輸入回覆提供協助或洽詢..." style="font-size: 0.85rem; padding: 0.35rem 0.75rem; border-radius: 6px; background: #fff;" onkeydown="if(event.key === 'Enter') addComment(${post.id})">
                        <button class="btn-primary" style="padding: 0.35rem 1rem; font-size: 0.85rem; border-radius: 6px; width: auto;" onclick="addComment(${post.id})">回覆</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// 註冊看板發文表單事件
const postForm = document.getElementById('postForm');
if (postForm) {
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const post_type = document.getElementById('postTradingType').value;
        const title = document.getElementById('postTitle').value;
        const item_type = document.getElementById('postType').value;
        const content = document.getElementById('postContent').value;
        const imageFile = document.getElementById('postImage').files[0];
        const errorDiv = document.getElementById('postError');

        try {
            errorDiv.style.display = 'none';
            const location = localStorage.getItem('user_location') || '';

            let price_or_condition = null;
            let price = 0.0;
            let item_health = 100;
            let item_carbon = 0.0;

            if (post_type === 'Trade') {
                price_or_condition = document.getElementById('postCondition').value;
                price = parseFloat(document.getElementById('postPrice').value) || 0.0;
                item_health = parseInt(document.getElementById('postItemHealth').value) || 100;
                
                // 初估材質碳排
                const mat = (document.getElementById('postItemMaterial').value || '').trim().toLowerCase();
                if (mat.includes('木')) {
                    item_carbon = 1.5;
                } else if (mat.includes('金') || mat.includes('鐵') || mat.includes('鋼')) {
                    item_carbon = 12.8;
                } else if (mat.includes('塑')) {
                    item_carbon = 6.2;
                } else {
                    item_carbon = 3.0;
                }
            }

            let imageData = null;
            if (imageFile) {
                if (imageFile.size > 500 * 1024) {
                    throw new Error('相片檔案大小不能超過 500KB！請壓縮後再重新上傳。');
                }
                imageData = await fileToBase64(imageFile);
            }

            await apiRequest('/board/posts', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    item_type,
                    content,
                    approx_location: location,
                    post_type,
                    price_or_condition,
                    price,
                    item_health,
                    item_carbon,
                    image_data: imageData
                })
            });

            closeModal('postModal');
            postForm.reset();
            onPostTradingTypeChange(); // 重置 Modal 顯隱
            loadPosts();
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
        }
    });
}

// 全域掛載以防範範疇問題
window.onPostTradingTypeChange = onPostTradingTypeChange;
window.onBoardFilterChange = onBoardFilterChange;
window.renderBoardItems = renderBoardItems;
window.addComment = addComment;
