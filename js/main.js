document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const homeBtn = document.getElementById('home-btn');
    const gameModal = document.getElementById('game-modal');
    const closeModal = document.getElementById('close-modal');
    const recommendBtn = document.getElementById('recommend-btn');
    const recommendationResults = document.getElementById('recommendation-results');
    const recommendationList = document.getElementById('recommendation-list');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const currentPageElement = document.getElementById('current-page');
    let currentPage = 1;

    // 加载游戏列表
    async function loadGames(page = 1) {
        const search = searchInput.value.trim();
        const data = await fetchGames(page, search);

        if (!data) {
            document.getElementById('game-list').innerHTML = '<p>无法加载数据，请稍后重试。</p>';
            return;
        }

        // Populate game list
        const gameList = document.getElementById('game-list');
        gameList.innerHTML = '';
        data.games.forEach(game => {
            const gameItem = `
                <div class="game-item" data-game-id="${game.id}">
                    <img src="${game.icon_url}" alt="${game.name}">
                    <div class="game-name">${game.name}</div>
                </div>`;
            gameList.insertAdjacentHTML('beforeend', gameItem);
        });

        // Add click event to each game item
        const gameItems = document.querySelectorAll('.game-item');
        gameItems.forEach(item => {
            item.addEventListener('click', async () => {
                const gameId = item.getAttribute('data-game-id');
                const gameDetails = await fetchGameDetails(gameId);
                if (gameDetails) {
                    showGameDetails(gameDetails);
                }
            });
        });

        // Update pagination
        generatePagination(data.totalPages, page);
    }

    // 获取游戏列表数据
    async function fetchGames(page, search) {
        try {
            const response = await fetch(`/api/games?page=${page}&search=${encodeURIComponent(search)}`);
            if (!response.ok) throw new Error('Failed to fetch games');
            return await response.json(); // { games: [...], totalPages: n }
        } catch (error) {
            console.error('Error fetching games:', error);
            return null;
        }
    }

    // 获取游戏详情数据
    async function fetchGameDetails(gameId) {
        try {
            const response = await fetch(`/api/games/${gameId}`);
            if (!response.ok) throw new Error('Failed to fetch game details');
            return await response.json();
        } catch (error) {
            console.error('Error fetching game details:', error);
            return null;
        }
    }

    // Unicode 解码
    function decodeUnicode(str) {
        return str.replace(/\\u[\dA-Fa-f]{4}/g, function(match) {
            return String.fromCharCode(parseInt(match.replace("\\u", ""), 16));
        });
    }

    // 显示游戏详情弹窗
    function showGameDetails(game) {
        document.getElementById('game-image').src = game.icon_url;
        document.getElementById('game-title').textContent = game.name;
        document.getElementById('game-rating').textContent = `评分: ${game.rating}`;
        document.getElementById('game-price').textContent = `价格: $${game.price}`;
        let desc = game.description;
        desc = decodeUnicode(desc);
        desc = desc.replace(/\\n/g, '<br>'); // 字符串里的 \n
        desc = desc.replace(/\n/g, '<br>');  // 物理换行
        document.getElementById('game-description').innerHTML = desc;
        gameModal.classList.remove('hidden');
    }

    // 关闭游戏详情弹窗
    closeModal.addEventListener('click', () => {
        gameModal.classList.add('hidden');
    });

    // 点击首页按钮
    homeBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentPage = 1;
        loadGames(currentPage);
    });

    // 点击搜索按钮
    searchBtn.addEventListener('click', () => {
        currentPage = 1;
        loadGames(currentPage);
    });


    // 分页功能
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadGames(currentPage);
        }
    });

    nextPageBtn.addEventListener('click', () => {
        currentPage++;
        loadGames(currentPage);
    });

    function generatePagination(totalPages, currentPage) {
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
        currentPageElement.textContent = currentPage;
    }

   // ================= 排行榜 ===================

// 排行榜变量
let rankingData = [];
let rankingCurrentPage = 1;
let rankingSortType = 'rating'; // 默认按评分
const rankingPageSize = 10;

// 排行榜弹窗打开
document.querySelector('.nav-links a:nth-child(3)').addEventListener('click', function(e){
    e.preventDefault();
    openRankingModal();
});

function openRankingModal() {
    // 拉取top25游戏
    fetch('/api/top_games')
        .then(resp => resp.json())
        .then(data => {
            rankingData = data.games || [];
            rankingCurrentPage = 1;
            rankingSortType = 'rating';
            showRankingList();
            document.getElementById('ranking-modal').classList.remove('hidden');
        });
}

// 排序和分页处理
function showRankingList() {
    // 排序
    let sorted = [...rankingData];
    if (rankingSortType === 'rating') {
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0)); // 评分高到低
    } else if (rankingSortType === 'price') {
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));   // 价格高到低
    } else if (rankingSortType === 'publish_time') {
        sorted.sort((a, b) => new Date(a.release_date) - new Date(b.release_date)); // 从早到晚
    }
    // 分页
    const start = (rankingCurrentPage - 1) * rankingPageSize;
    const end = start + rankingPageSize;
    const pageGames = sorted.slice(start, end);

    // 渲染
    const ul = document.getElementById('ranking-list');
    ul.innerHTML = '';
    pageGames.forEach((game, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span style="width:24px;color:#4CAF50; font-weight:bold;">${start + idx + 1}</span>
            <img src="${game.icon_url}" alt="${game.name}">
            <div class="rank-info">
                <span class="rank-title">${game.name}</span>
                <span class="rank-detail">
                    评分：${game.rating ?? '无'}　
                    价格：${game.price ?? '无'}　
                    发布时间：${game.release_date ? game.release_date : '无'}
                </span>
            </div>
        `;
        ul.appendChild(li);
    });
    document.getElementById('ranking-current-page').innerText = rankingCurrentPage;
}
// 推荐功能：点击“优选游戏”按钮时展示推荐结果
recommendBtn.addEventListener('click', () => {
    fetch('/api/custom_recommend')
        .then(response => response.json())
        .then(data => {
            let html = `
                <table border="1" style="margin:20px auto;min-width:320px;text-align:center;background:#fff;">
                    <thead>
                        <tr>
                            <th>游戏ID</th>
                            <th>图标</th>
                            <th>游戏名称</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            data.forEach(item => {
                html += `
                    <tr>
                        <td>${item.id}</td>
                        <td><img src="${item.icon_url}" alt="${item.name}" style="width:36px;height:36px;border-radius:8px;"></td>
                        <td>${item.name}</td>
                    </tr>
                `;
            });
            html += `
                    </tbody>
                </table>
            `;
            recommendationResults.classList.remove("hidden");
            recommendationList.innerHTML = html;
        })
        .catch(error => {
            recommendationList.innerHTML = "<li>推荐请求失败，请稍后重试</li>";
            recommendationResults.classList.remove("hidden");
        });
});
// 排序按钮事件
document.querySelectorAll('.rank-sort-btn').forEach(btn => {
    btn.onclick = function(){
        document.querySelectorAll('.rank-sort-btn').forEach(b=>b.classList.remove('active'));
        this.classList.add('active');
        rankingSortType = this.dataset.sort;
        rankingCurrentPage = 1;
        showRankingList();
    };
});

// 排行榜分页按钮
document.getElementById('ranking-prev-page').onclick = function(){
    if (rankingCurrentPage > 1) {
        rankingCurrentPage--;
        showRankingList();
    }
};
document.getElementById('ranking-next-page').onclick = function(){
    const totalPages = Math.ceil(rankingData.length / rankingPageSize);
    if (rankingCurrentPage < totalPages) {
        rankingCurrentPage++;
        showRankingList();
    }
};

// 弹窗关闭
document.getElementById('close-ranking-modal').onclick = function(){
    document.getElementById('ranking-modal').classList.add('hidden');
};
// 可点击遮罩关闭
document.getElementById('ranking-modal').addEventListener('click', function(e){
    if(e.target === this) this.classList.add('hidden');
});

    // 页面初始加载第一页
    loadGames(currentPage);
});