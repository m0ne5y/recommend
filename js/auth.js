// 登录注册弹窗逻辑
function showAuthModal(type = 'login') {
    document.getElementById('mask').classList.remove('hidden');
    document.getElementById('auth-modal').classList.remove('hidden');
    renderAuthForm(type);
}

function hideAuthModal() {
    document.getElementById('mask').classList.add('hidden');
    document.getElementById('auth-modal').classList.add('hidden');
}

function renderAuthForm(type) {
    const modalContent = document.getElementById('auth-modal-content');
    if (type === 'login') {
        modalContent.innerHTML = `
            <h2>账号登录</h2>
            <form id="login-form" autocomplete="off">
                <input type="text" id="login-username" placeholder="账号" required>
                <input type="password" id="login-password" placeholder="密码" required>
                <button type="submit">立即登录</button>
                <div class="error-msg" id="login-error"></div>
            </form>
            <div class="form-footer">新用户？
                <span class="switch-link" id="to-register">点击注册</span>
            </div>
        `;
        document.getElementById('to-register').onclick = () => renderAuthForm('register');
        document.getElementById('login-form').onsubmit = handleLogin;
    } else {
        modalContent.innerHTML = `
            <h2>注册新账号</h2>
            <form id="register-form" autocomplete="off">
                <input type="text" id="register-username" placeholder="账号" required>
                <input type="password" id="register-password" placeholder="密码" required>
                <input type="password" id="register-password2" placeholder="确认密码" required>
                <button type="submit">注册账号</button>
                <div class="error-msg" id="register-error"></div>
            </form>
            <div class="form-footer">已有账号？
                <span class="switch-link" id="to-login">返回登录</span>
            </div>
        `;
        document.getElementById('to-login').onclick = () => renderAuthForm('login');
        document.getElementById('register-form').onsubmit = handleRegister;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');
    errDiv.textContent = '';
    try {
        const res = await apiLogin(username, password);
        if (res.user_id) {
            localStorage.setItem('user_id', res.user_id);
            showToast('登录成功', 'success');
            setTimeout(() => {
                hideAuthModal();
                window.location.reload();
            }, 600);
        } else {
            errDiv.textContent = res.error || '登录失败';
            showToast(res.error || '登录失败', 'error');
        }
    } catch (e) {
        errDiv.textContent = '网络错误';
        showToast('网络错误', 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    const errDiv = document.getElementById('register-error');
    errDiv.textContent = '';
    if (password !== password2) {
        errDiv.textContent = '两次输入密码不一致';
        showToast('两次输入密码不一致', 'error');
        return;
    }
    try {
        const res = await apiRegister(username, password);
        if (res.message) {
            showToast('注册成功，请登录', 'success');
            setTimeout(() => renderAuthForm('login'), 800);
        } else {
            errDiv.textContent = res.error || '注册失败';
            showToast(res.error || '注册失败', 'error');
        }
    } catch (e) {
        errDiv.textContent = '网络错误';
        showToast('网络错误', 'error');
    }
}

// Toast弹窗
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}